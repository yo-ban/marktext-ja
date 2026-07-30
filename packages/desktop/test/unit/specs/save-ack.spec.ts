import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` reads `window.path` at module load and `window.electron` /
// `window.fileUtils` at runtime; stub those surfaces before the hoisted imports.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p, basename: (p: string) => p }
  w.window.fileUtils ??= { isSamePathSync: (a: string, b: string) => a === b }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: {
      send: () => {},
      on: () => {},
      invoke: () => Promise.resolve(false)
    }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

// The buffered-state debounce would fire under fake timers and drag the project
// and layout stores in; the save bookkeeping under test does not involve it.
vi.mock('@/store/bufferedState', () => ({
  sendBufferedState: () => Promise.resolve(false),
  debouncedSendBufferedState: () => {},
  createBufferedState: () => null
}))

import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'

type IpcHandler = (event: unknown, ...args: unknown[]) => void

// Capture the channel handlers the store installs so tests can deliver an ack
// exactly as the main process would.
function captureIpcHandlers(): Map<string, IpcHandler> {
  const handlers = new Map<string, IpcHandler>()
  vi.spyOn(window.electron.ipcRenderer, 'on').mockImplementation(((
    channel: string,
    cb: IpcHandler
  ) => {
    handlers.set(channel, cb)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any)
  return handlers
}

function makeTab(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tab-1',
    filename: 'note.md',
    pathname: '/tmp/note.md',
    markdown: 'hello',
    isSaved: false,
    lastSavedHistoryId: -1,
    history: { stack: [{ id: 1 }, { id: 2 }], lastEditIndex: 0, lastInitIndex: -1 },
    notifications: [],
    encoding: { encoding: 'utf8', isBom: false },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 2,
    ...overrides
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function seed(store: ReturnType<typeof useEditorStore>, tab: ReturnType<typeof makeTab>) {
  store.tabs = [tab]
  store.currentFile = tab
  store.updateTabIdToIndex()
}

describe('editor store — save acknowledgement bookkeeping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Rename and "Move to" reuse `mt::set-pathname`, but they only move the file
  // on disk. Marking the tab saved discarded the pending edits silently: the
  // close prompt filters on `isSaved`, so the window closed without asking.
  it('a rename does not mark a dirty tab as saved', () => {
    const store = useEditorStore()
    const tab = makeTab()
    seed(store, tab)
    const handlers = captureIpcHandlers()
    store.LISTEN_FOR_SET_PATHNAME()

    handlers.get('mt::set-pathname')!(null, {
      id: 'tab-1',
      pathname: '/tmp/renamed.md',
      filename: 'renamed.md',
      contentSaved: false
    })

    expect(tab.pathname).toBe('/tmp/renamed.md')
    expect(tab.filename).toBe('renamed.md')
    expect(tab.isSaved).toBe(false)
  })

  it('a save that had to pick a path still marks the tab saved', () => {
    const store = useEditorStore()
    const tab = makeTab({ pathname: '' })
    seed(store, tab)
    const handlers = captureIpcHandlers()
    store.LISTEN_FOR_SET_PATHNAME()

    handlers.get('mt::set-pathname')!(null, {
      id: 'tab-1',
      pathname: '/tmp/note.md',
      filename: 'note.md',
      contentSaved: true
    })

    expect(tab.pathname).toBe('/tmp/note.md')
    expect(tab.isSaved).toBe(true)
  })

  // The ack only carries a tab id, so it used to be read as "everything typed
  // so far is on disk". A keystroke made while the write was in flight is not
  // in the snapshot that was written, and would be lost on close.
  it('an edit made during the write leaves the tab dirty', () => {
    const store = useEditorStore()
    const tab = makeTab()
    seed(store, tab)
    const handlers = captureIpcHandlers()
    store.LISTEN_FOR_SET_PATHNAME()

    store.FILE_SAVE()
    // Keystroke lands while main is writing: a new history entry becomes current.
    tab.history.lastEditIndex = 1
    handlers.get('mt::tab-saved')!(null, 'tab-1')

    expect(tab.isSaved).toBe(false)
    // What reached disk is still recorded, so the next save is judged against it.
    expect(tab.lastSavedHistoryId).toBe(1)
  })

  it('an undisturbed save marks the tab saved', () => {
    const store = useEditorStore()
    const tab = makeTab()
    seed(store, tab)
    const handlers = captureIpcHandlers()
    store.LISTEN_FOR_SET_PATHNAME()

    store.FILE_SAVE()
    handlers.get('mt::tab-saved')!(null, 'tab-1')

    expect(tab.isSaved).toBe(true)
    expect(tab.lastSavedHistoryId).toBe(1)
  })

  it('a failed write does not leave a pending save behind', () => {
    const store = useEditorStore()
    const tab = makeTab()
    seed(store, tab)
    const handlers = captureIpcHandlers()
    store.LISTEN_FOR_SET_PATHNAME()

    store.FILE_SAVE()
    handlers.get('mt::tab-save-failure')!(null, 'tab-1', 'disk full')
    expect(tab.isSaved).toBe(false)

    // The retry's own ack must not be matched against the failed attempt: it
    // saves the newer edit, so it is what the tab is judged clean against.
    tab.history.lastEditIndex = 1
    store.FILE_SAVE()
    handlers.get('mt::tab-saved')!(null, 'tab-1')
    expect(tab.isSaved).toBe(true)
    expect(tab.lastSavedHistoryId).toBe(2)
  })

  // The timer used to send the pathname captured when it was scheduled. A
  // rename in between recreated the old file with the new content, while the
  // renamed file kept the stale content and the tab claimed to be saved.
  it('auto-save writes to the tab’s current path, not the one captured at schedule time', () => {
    vi.useFakeTimers()
    const store = useEditorStore()
    const preferences = usePreferencesStore()
    preferences.autoSaveDelay = 5000
    const tab = makeTab()
    seed(store, tab)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.HANDLE_AUTO_SAVE({ id: 'tab-1', pathname: '/tmp/note.md' })
    // Sidebar rename while the timer is pending.
    tab.pathname = '/tmp/renamed.md'
    tab.filename = 'renamed.md'
    tab.markdown = 'hello, more text'
    vi.advanceTimersByTime(5001)

    const call = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save')
    expect(call).toBeDefined()
    expect(call?.[3]).toBe('/tmp/renamed.md')
    expect(call?.[4]).toBe('hello, more text')
  })
})
