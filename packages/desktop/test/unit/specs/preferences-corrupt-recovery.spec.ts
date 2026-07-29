import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// F1 regression guard: a corrupt / schema-violating preferences.json made
// `new Store(...)` throw inside the Preference constructor, which bubbled up
// to a startup error dialog and process.exit(1) — the app could never start
// again until the user found and deleted the file by hand (--safe didn't
// help). The fix backs the bad file up and restarts from defaults.

const { storeBehavior, showErrorBox } = vi.hoisted(() => ({
  // Controls the mocked electron-store: how many constructions should throw.
  storeBehavior: { throwCount: 0, constructed: 0 },
  showErrorBox: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { on: vi.fn(), handle: vi.fn(), emit: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false, on: vi.fn() },
  dialog: { showErrorBox }
}))

vi.mock('electron-log', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock('electron-store', () => ({
  default: class FakeStore {
    private data: Record<string, unknown> = {}
    constructor() {
      storeBehavior.constructed += 1
      if (storeBehavior.throwCount > 0) {
        storeBehavior.throwCount -= 1
        throw new Error('Config schema violation: `theme` must be string')
      }
    }

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
// Real defaults file — init() reads `${__static}/preference.json`.
;(global as { __static?: string }).__static = path.resolve(here, '../../../static')

const { default: Preference } = await import('main_renderer/preferences')

describe('Preference — corrupt preferences.json recovery (F1)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-prefs-'))
    storeBehavior.throwCount = 0
    storeBehavior.constructed = 0
    showErrorBox.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('backs up the corrupt file and restarts from defaults instead of throwing', () => {
    const prefsFile = path.join(tmpDir, 'preferences.json')
    fs.writeFileSync(prefsFile, '{"theme": 42,, not-json')
    storeBehavior.throwCount = 1

    const preference = new Preference({ preferencesPath: tmpDir })

    // The broken file was moved aside, not destroyed.
    expect(fs.existsSync(prefsFile)).toBe(false)
    const backups = fs.readdirSync(tmpDir).filter((f) => f.startsWith('preferences.json.corrupt-'))
    expect(backups).toHaveLength(1)

    // A second store construction succeeded and was seeded with defaults.
    expect(storeBehavior.constructed).toBe(2)
    const all = preference.getAll() as Record<string, unknown>
    expect(Object.keys(all).length).toBeGreaterThan(0)
    expect(all.theme).toBeDefined()

    // The user is told their settings were reset and where the backup is.
    expect(showErrorBox).toHaveBeenCalledTimes(1)
  })

  it('constructs the store once and keeps the file when it is valid', () => {
    const preference = new Preference({ preferencesPath: tmpDir })

    expect(storeBehavior.constructed).toBe(1)
    expect(showErrorBox).not.toHaveBeenCalled()
    expect(preference.getAll()).toBeDefined()
  })
})
