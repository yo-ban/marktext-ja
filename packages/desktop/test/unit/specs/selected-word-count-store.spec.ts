import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      electron?: {
        clipboard: { writeText: (s: string) => void }
        ipcRenderer: { send: (...args: unknown[]) => void; on: (...args: unknown[]) => void }
      }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useEditorStore } from '@/store/editor'

describe('selected word count and lightweight source cursor state (#4457)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores and clears the transient selection count', () => {
    const store = useEditorStore()
    const count = { word: 2, character: 13, paragraph: 1, all: 14 }

    store.SET_SELECTED_WORD_COUNT(count)
    expect(store.selectedWordCount).toEqual(count)

    store.SET_SELECTED_WORD_COUNT(null)
    expect(store.selectedWordCount).toBeNull()
  })

  it('persists a source cursor without touching document content', () => {
    const store = useEditorStore()
    const tab = { id: 'tab-1', markdown: 'unchanged', muyaIndexCursor: null }
    store.tabs = [tab] as unknown as typeof store.tabs
    store.tabIdToIndex = { 'tab-1': 0 }
    const cursor = {
      anchor: { line: 1, ch: 2 },
      focus: { line: 1, ch: 5 }
    }

    store.PERSIST_SOURCE_CURSOR('tab-1', cursor)

    expect(tab.muyaIndexCursor).toEqual(cursor)
    expect(tab.markdown).toBe('unchanged')
  })
})
