import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regression guard for the close-window save flow losing documents (A1):
// `mt::close-window-confirm` treated every save attempt as success — an
// Esc-canceled save dialog and a failed disk write both resolved, so the
// window closed and the unsaved document was destroyed. The failure dialog in
// the old `.catch` was unreachable dead code (handleResponseForSave swallowed
// rejections). The fix makes each save report saved/canceled/failed and gates
// the close on the outcomes.

const {
  ipcHandlers,
  ipcEmit,
  showMessageBox,
  showSaveDialog,
  fromWebContents,
  webContentsSend,
  writeMarkdownFile
} = vi.hoisted(() => ({
  ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  ipcEmit: vi.fn(),
  showMessageBox: vi.fn(),
  showSaveDialog: vi.fn(),
  fromWebContents: vi.fn(),
  webContentsSend: vi.fn(),
  writeMarkdownFile: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, listener)
    },
    handle: () => {},
    emit: ipcEmit
  },
  dialog: { showMessageBox, showSaveDialog },
  BrowserWindow: { fromWebContents },
  app: { getPath: () => '/tmp' },
  shell: {}
}))

vi.mock('electron-log', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('fs-extra', () => ({ rename: vi.fn() }))
vi.mock('common/filesystem', () => ({
  isDirectory: vi.fn(),
  isFile: vi.fn(),
  exists: vi.fn()
}))
vi.mock('main_renderer/menu/actions/marktext', () => ({
  checkUpdates: vi.fn(),
  userSetting: vi.fn()
}))
vi.mock('main_renderer/menu/actions/view', () => ({ showTabBar: vi.fn() }))
vi.mock('main_renderer/commands', () => ({ COMMANDS: {} }))
vi.mock('main_renderer/filesystem', () => ({
  normalizeAndResolvePath: vi.fn(),
  writeFile: vi.fn()
}))
vi.mock('main_renderer/filesystem/markdown', () => ({ writeMarkdownFile }))
vi.mock('main_renderer/utils', () => ({
  getPath: vi.fn(() => '/tmp'),
  getRecommendTitleFromMarkdownString: vi.fn(() => '')
}))
vi.mock('main_renderer/utils/pandoc', () => ({ default: vi.fn() }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

// Importing the module registers the ipcMain handlers (side effect).
await import('main_renderer/menu/actions/file')

const FAKE_WIN = { id: 7, webContents: { send: webContentsSend } }
const fakeEvent = { sender: {} } as never

const savedFile = (id: string) => ({
  id,
  filename: `${id}.md`,
  pathname: `/docs/${id}.md`,
  markdown: `# ${id}`,
  options: { encoding: { encoding: 'utf8' }, lineEnding: 'lf', trimTrailingNewline: 2 },
  defaultPath: '/docs'
})

// No pathname → handleResponseForSave opens the (mocked) save dialog.
const untitledFile = (id: string) => ({ ...savedFile(id), pathname: undefined })

function getHandler() {
  const handler = ipcHandlers.get('mt::close-window-confirm')
  if (!handler) throw new Error('mt::close-window-confirm handler was not registered')
  return handler
}

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('mt::close-window-confirm save outcomes (A1)', () => {
  beforeEach(() => {
    ipcEmit.mockReset()
    showMessageBox.mockReset()
    showSaveDialog.mockReset()
    webContentsSend.mockReset()
    writeMarkdownFile.mockReset()
    fromWebContents.mockReset()
    fromWebContents.mockReturnValue(FAKE_WIN)
  })

  it('closes the window when every file saves successfully', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 0 }) // Save
    writeMarkdownFile.mockResolvedValue(undefined)

    await getHandler()(fakeEvent, [savedFile('a'), savedFile('b')])
    await flushTimers()

    expect(writeMarkdownFile).toHaveBeenCalledTimes(2)
    expect(ipcEmit).toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
  })

  it('keeps the window open when the user cancels a save dialog', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 0 }) // Save
    showSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true })

    await getHandler()(fakeEvent, [untitledFile('a')])
    await flushTimers()

    expect(writeMarkdownFile).not.toHaveBeenCalled()
    expect(ipcEmit).not.toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
  })

  it('shows the failure dialog when a write fails, and "keep open" aborts the close', async() => {
    showMessageBox
      .mockResolvedValueOnce({ response: 0 }) // Save
      .mockResolvedValueOnce({ response: 1 }) // failure dialog → Keep open
    writeMarkdownFile.mockRejectedValue(new Error('EACCES: permission denied'))

    await getHandler()(fakeEvent, [savedFile('a')])
    await flushTimers()

    expect(showMessageBox).toHaveBeenCalledTimes(2)
    expect(showMessageBox.mock.calls[1][1]).toMatchObject({ type: 'error' })
    expect(ipcEmit).not.toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
    // The renderer is still told about the per-tab failure.
    expect(webContentsSend).toHaveBeenCalledWith(
      'mt::tab-save-failure',
      'a',
      'EACCES: permission denied'
    )
  })

  it('failure dialog "close anyway" closes the window', async() => {
    showMessageBox
      .mockResolvedValueOnce({ response: 0 }) // Save
      .mockResolvedValueOnce({ response: 0 }) // failure dialog → Close
    writeMarkdownFile.mockRejectedValue(new Error('disk full'))

    await getHandler()(fakeEvent, [savedFile('a')])
    await flushTimers()

    expect(ipcEmit).toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
  })

  it('"don\'t save" closes without writing', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 1 }) // Don't save

    await getHandler()(fakeEvent, [savedFile('a')])
    await flushTimers()

    expect(writeMarkdownFile).not.toHaveBeenCalled()
    expect(ipcEmit).toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
  })

  it('cancel on the unsaved-files prompt neither writes nor closes', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 2 }) // Cancel

    await getHandler()(fakeEvent, [savedFile('a')])
    await flushTimers()

    expect(writeMarkdownFile).not.toHaveBeenCalled()
    expect(ipcEmit).not.toHaveBeenCalledWith('window-close-by-id', FAKE_WIN.id)
  })
})

// A2: closing a project used to close the already-saved tabs BEFORE the
// unsaved-files dialog resolved, so Cancel could not bring them back. The
// renderer now defers them to main via the savedTabIds argument; main closes
// them only when the user did not cancel.
describe('mt::save-and-close-tabs deferred saved tabs (A2)', () => {
  const getSaveCloseHandler = () => {
    const handler = ipcHandlers.get('mt::save-and-close-tabs')
    if (!handler) throw new Error('mt::save-and-close-tabs handler was not registered')
    return handler
  }

  beforeEach(() => {
    ipcEmit.mockReset()
    showMessageBox.mockReset()
    showSaveDialog.mockReset()
    webContentsSend.mockReset()
    writeMarkdownFile.mockReset()
    fromWebContents.mockReset()
    fromWebContents.mockReturnValue(FAKE_WIN)
  })

  it('cancel closes nothing — saved tabs survive', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 2 }) // Cancel

    await getSaveCloseHandler()(fakeEvent, [savedFile('dirty')], ['clean1', 'clean2'])
    await flushTimers()

    expect(webContentsSend).not.toHaveBeenCalledWith(
      'mt::force-close-tabs-by-id',
      expect.anything()
    )
  })

  it('save closes the saved tabs together with the successfully saved ones', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 0 }) // Save
    writeMarkdownFile.mockResolvedValue(undefined)

    await getSaveCloseHandler()(fakeEvent, [savedFile('dirty')], ['clean1'])
    await flushTimers()

    expect(webContentsSend).toHaveBeenCalledWith('mt::force-close-tabs-by-id', [
      'clean1',
      'dirty'
    ])
  })

  it('a tab whose save dialog was canceled stays open; the rest close', async() => {
    showMessageBox.mockResolvedValueOnce({ response: 0 }) // Save
    showSaveDialog.mockResolvedValue({ filePath: undefined, canceled: true })
    writeMarkdownFile.mockResolvedValue(undefined)

    await getSaveCloseHandler()(
      fakeEvent,
      [savedFile('dirty'), untitledFile('untitled')],
      ['clean1']
    )
    await flushTimers()

    expect(webContentsSend).toHaveBeenCalledWith('mt::force-close-tabs-by-id', [
      'clean1',
      'dirty'
    ])
  })

  it("don't save closes saved and unsaved tabs without writing", async() => {
    showMessageBox.mockResolvedValueOnce({ response: 1 }) // Don't save

    await getSaveCloseHandler()(fakeEvent, [savedFile('dirty')], ['clean1'])
    await flushTimers()

    expect(writeMarkdownFile).not.toHaveBeenCalled()
    expect(webContentsSend).toHaveBeenCalledWith('mt::force-close-tabs-by-id', [
      'clean1',
      'dirty'
    ])
  })
})
