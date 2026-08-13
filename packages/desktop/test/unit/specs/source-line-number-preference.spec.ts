import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      electron?: { ipcRenderer: { send: (...args: unknown[]) => void; on: () => void } }
    }
  }
  w.window ??= {}
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
})

import { usePreferencesStore } from '@/store/preferences'

describe('Source Code line-number preference (#4908)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('preserves the selected interval across a menu off/on toggle', () => {
    const store = usePreferencesStore()
    store.SET_SINGLE_PREFERENCE({ type: 'sourceLineNumberFrequency', value: 5 })

    store.TOGGLE_SOURCE_LINE_NUMBERS()
    expect(store.sourceLineNumberFrequency).toBe(0)

    store.TOGGLE_SOURCE_LINE_NUMBERS()
    expect(store.sourceLineNumberFrequency).toBe(5)
  })

  it('persists each toggle through the preference IPC channel', () => {
    const store = usePreferencesStore()
    const send = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.TOGGLE_SOURCE_LINE_NUMBERS()
    store.TOGGLE_SOURCE_LINE_NUMBERS()

    expect(send).toHaveBeenNthCalledWith(1, 'mt::set-user-preference', {
      sourceLineNumberFrequency: 0
    })
    expect(send).toHaveBeenNthCalledWith(2, 'mt::set-user-preference', {
      sourceLineNumberFrequency: 10
    })
  })
})
