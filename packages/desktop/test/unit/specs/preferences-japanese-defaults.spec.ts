import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// This fork ships Japanese as the default UI language: the static defaults
// carry language "ja", first-start OS detection still wins when it finds a
// supported language, and a first start that resolves to Japanese also hides
// the spell checker's squiggles (Chromium has no Japanese dictionary, so the
// en-US checker over Japanese text produces only noise marks; right-click
// suggestions keep working and the preference can re-show them).

const { systemLocale, storeSeed } = vi.hoisted(() => ({
  systemLocale: { value: 'ja-JP' },
  // Simulates what the real electron-store loads from an existing
  // preferences.json; cleared per test.
  storeSeed: { value: {} as Record<string, unknown> }
}))

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), getLocale: () => systemLocale.value },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { on: vi.fn(), handle: vi.fn(), emit: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false, on: vi.fn() },
  dialog: { showErrorBox: vi.fn() }
}))

vi.mock('electron-log', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock('electron-store', () => ({
  default: class FakeStore {
    private data: Record<string, unknown> = { ...storeSeed.value }
    get store() {
      return { ...this.data }
    }

    get(key: string) {
      return this.data[key]
    }

    set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === 'string') this.data[key] = value
      else Object.assign(this.data, key)
    }

    delete(key: string) {
      delete this.data[key]
    }
  }
}))

vi.mock('main_renderer/config', () => ({ isWindows: false }))
vi.mock('main_renderer/utils/internalIpc', () => ({ onInternalChannel: vi.fn() }))
vi.mock('main_renderer/utils', () => ({
  hasSameKeys: (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    return JSON.stringify(ka) === JSON.stringify(kb)
  }
}))

const here = path.dirname(fileURLToPath(import.meta.url))
;(global as { __static?: string }).__static = path.resolve(here, '../../../static')

const { default: Preference } = await import('main_renderer/preferences')

describe('Preference — Japanese-first defaults', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-ja-prefs-'))
    storeSeed.value = {}
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('a Japanese OS first start gets language ja and hidden spelling marks', () => {
    systemLocale.value = 'ja-JP'
    const preference = new Preference({ preferencesPath: tmpDir })
    const all = preference.getAll() as Record<string, unknown>

    expect(all.language).toBe('ja')
    expect(all.spellcheckerNoUnderline).toBe(true)
    // The checker itself stays off by default.
    expect(all.spellcheckerEnabled).toBe(false)
  })

  it('an English OS first start keeps English and visible spelling marks', () => {
    systemLocale.value = 'en-US'
    const preference = new Preference({ preferencesPath: tmpDir })
    const all = preference.getAll() as Record<string, unknown>

    expect(all.language).toBe('en')
    expect(all.spellcheckerNoUnderline).toBe(false)
  })

  it('an unsupported OS locale falls back to the shipped default: Japanese', () => {
    systemLocale.value = 'sw-KE'
    const preference = new Preference({ preferencesPath: tmpDir })
    const all = preference.getAll() as Record<string, unknown>

    expect(all.language).toBe('ja')
    expect(all.spellcheckerNoUnderline).toBe(true)
  })

  it('an empty locale (before app-ready) falls back to Japanese, not en', () => {
    // Regression guard: getLocale() is '' before app-ready, and the empty
    // primary tag used to match EVERY supported language via startsWith('') —
    // detection always "found" en, so the OS language never applied.
    systemLocale.value = ''
    const preference = new Preference({ preferencesPath: tmpDir })
    const all = preference.getAll() as Record<string, unknown>

    expect(all.language).toBe('ja')
    expect(all.spellcheckerNoUnderline).toBe(true)
  })

  it('an existing preferences file is never overridden by detection', () => {
    fs.writeFileSync(path.join(tmpDir, 'preferences.json'), JSON.stringify({ language: 'de' }))
    storeSeed.value = { language: 'de', spellcheckerNoUnderline: false }
    systemLocale.value = 'ja-JP'
    const preference = new Preference({ preferencesPath: tmpDir })
    const all = preference.getAll() as Record<string, unknown>

    expect(all.language).toBe('de')
    expect(all.spellcheckerNoUnderline).toBe(false)
  })
})
