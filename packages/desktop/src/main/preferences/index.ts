import fs from 'fs'
import path from 'path'
import Store, { type Schema } from 'electron-store'
import { BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { getSystemLanguageCandidates, t } from '../i18n'
import { isWindows } from '../config'
import { hasSameKeys } from '../utils'
import { onInternalChannel } from '../utils/internalIpc'
import { detectSupportedLanguage } from 'common/i18n'
import { TypedEmitter } from '@shared/types/typedEmitter'
import type { IUserPreferences } from '@shared/types/preferences'
import schema from './schema.json'

const PREFERENCES_FILE_NAME = 'preferences'

// The Preference class extends EventEmitter but does not currently emit any
// events itself — keep the event map empty until concrete events are added.
type PreferenceEvents = Record<string, unknown[]>

// Structural subset of EnvPaths/AppPaths — only `preferencesPath` is read here.
interface AppPaths {
  readonly preferencesPath: string
}

class Preference extends TypedEmitter<PreferenceEvents> {
  public readonly preferencesPath: string
  public readonly hasPreferencesFile: boolean
  public readonly store: Store<IUserPreferences>
  public readonly staticPath: string

  /**
   * @param paths The path instance.
   *
   * A corrupt or schema-violating preferences.json is moved aside and the
   * store restarts from defaults — a bad settings file must never brick
   * startup (there is no other way for the user to recover in-app).
   */
  constructor(paths: AppPaths) {
    // TODO: Preferences should not loaded if global.MARKTEXT_SAFE_MODE is set.
    super()

    const { preferencesPath } = paths
    this.preferencesPath = preferencesPath
    const preferencesFilePath = path.join(this.preferencesPath, `${PREFERENCES_FILE_NAME}.json`)
    this.hasPreferencesFile = fs.existsSync(preferencesFilePath)

    const createStore = () =>
      new Store<IUserPreferences>({
        schema: schema as unknown as Schema<IUserPreferences>,
        name: PREFERENCES_FILE_NAME,
        migrations: {
          '0.18.6': (store) => {
            if (store.get('startUpAction') === 'lastState') {
              store.set('startUpAction', 'openLastFolder')
            }
          }
        },
        beforeEachMigration: (_store, context) => {
          log.info(`Preferences migration: ${context.fromVersion} -> ${context.toVersion}`)
        }
      })

    try {
      this.store = createStore()
    } catch (err) {
      // Schema violation or unparseable JSON. Keep the broken file for manual
      // inspection, then start over from defaults.
      log.error('Preferences file is corrupt or violates the schema:', err)
      const backupPath = `${preferencesFilePath}.corrupt-${Date.now()}`
      try {
        fs.renameSync(preferencesFilePath, backupPath)
      } catch (renameErr) {
        log.error('Could not back up the corrupt preferences file:', renameErr)
        fs.rmSync(preferencesFilePath, { force: true })
      }
      // Behave like a first start so init() seeds all defaults (and the
      // system language) into the fresh store.
      this.hasPreferencesFile = false
      this.store = createStore()
      dialog.showErrorBox(
        t('error.preferencesResetTitle'),
        t('error.preferencesResetMessage', { path: backupPath })
      )
    }

    this.staticPath = path.join(global.__static, 'preference.json')
    this.init()
  }

  init = (): void => {
    let defaultSettings: Record<string, unknown> | null = null
    try {
      defaultSettings = JSON.parse(fs.readFileSync(this.staticPath, { encoding: 'utf8' }) || '{}')

      // Set best theme on first application start.
      if (nativeTheme.shouldUseDarkColors) {
        defaultSettings!.theme = 'dark'
      }

      // Set system language on first application start. When detection finds
      // no supported language the static default applies — this fork ships
      // with Japanese as that default.
      if (!this.hasPreferencesFile) {
        const systemLanguage = this._getSystemLanguage()
        if (systemLanguage) {
          defaultSettings!.language = systemLanguage
        }

        // Chromium has no Japanese dictionary, so if the user ever turns the
        // (default-off) spell checker on, its en-US pass over Japanese text
        // produces only noise marks. Start Japanese installs with the
        // squiggles hidden — right-click suggestions keep working, and the
        // preference can re-show them explicitly.
        if (defaultSettings!.language === 'ja') {
          defaultSettings!.spellcheckerNoUnderline = true
        }
      }
    } catch (err) {
      log.error(err)
    }

    if (!defaultSettings) {
      throw new Error('Can not load static preference.json file')
    }

    // I don't know why `this.store.size` is 3 when first load, so I just check file existed.
    if (!this.hasPreferencesFile) {
      this.store.set(defaultSettings)
    } else {
      // Because `this.getAll()` will return a plainObject, so we can not use `hasOwnProperty` method
      // const plainObject = () => Object.create(null)
      const userSetting = this.getAll() as Record<string, unknown>
      // Update outdated settings
      const requiresUpdate = !hasSameKeys(defaultSettings, userSetting)
      const userSettingKeys = Object.keys(userSetting)
      const defaultSettingKeys = Object.keys(defaultSettings)

      if (requiresUpdate) {
        // TODO(fxha): For performance reasons, we should try to replace 'electron-store' because
        //   it does multiple blocking I/O calls when changing entries. There is no transaction or
        //   async I/O available. The core reason we changed to it was JSON scheme validation.

        // Remove outdated settings
        for (const key of userSettingKeys) {
          if (!defaultSettingKeys.includes(key)) {
            delete userSetting[key]
            this.store.delete(key)
          }
        }

        // Add new setting options
        let addedNewEntries = false
        for (const key in defaultSettings) {
          if (!userSettingKeys.includes(key)) {
            addedNewEntries = true
            userSetting[key] = defaultSettings[key]
          }
        }
        if (addedNewEntries) {
          this.store.set(userSetting)
        }
      }
    }

    this._listenForIpcMain()
  }

  getAll(): IUserPreferences {
    return this.store.store as IUserPreferences
  }

  setItem(key: string, value: unknown): void {
    this.store.set(key, value)
    ipcMain.emit('broadcast-preferences-changed', { [key]: value })
  }

  getItem<T = unknown>(key: string): T {
    return this.store.get(key) as T
  }

  /**
   * Change multiple setting entries.
   *
   * @param settings A settings object or subset object with key/value entries.
   */
  setItems(settings: Record<string, unknown> | null | undefined): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).forEach((key) => {
      this.setItem(key, settings[key])
    })
  }

  getPreferredEol(): 'lf' | 'crlf' {
    const endOfLine = this.getItem<string>('endOfLine')
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  exportJSON(): void {
    // todo
  }

  importJSON(): void {
    // todo
  }

  _listenForIpcMain(): void {
    ipcMain.on('mt::ask-for-user-preference', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (win) {
        win.webContents.send('mt::user-preference', this.getAll())
      }
    })
    ipcMain.on('mt::set-user-preference', (_e, settings: Record<string, unknown>) => {
      this.setItems(settings)
    })
    ipcMain.on('mt::cmd-toggle-autosave', () => {
      this.setItem('autoSave', !this.getItem('autoSave'))
    })

    onInternalChannel('set-user-preference', (settings: Record<string, unknown>) => {
      this.setItems(settings)
    })
  }

  /**
   * Gets the system language, or null if it's not in the supported list
   * @returns Supported system language code or null
   */
  _getSystemLanguage(): string | null {
    try {
      // NOTE: this runs before app-ready, where getLocale() (and possibly the
      // preferred-languages list) is still empty; the POSIX locale environment
      // in the candidate list is what can still succeed here. Empty candidates
      // are skipped — an empty tag must not primary-match the first list
      // entry via startsWith('').
      const candidates = getSystemLanguageCandidates()
      const matched = detectSupportedLanguage(candidates)
      if (matched) {
        log.info(`Using system language: ${matched} (candidates: ${candidates.join(', ')})`)
      } else {
        log.info(`No supported system language among: ${candidates.join(', ') || '(none)'}`)
      }
      return matched
    } catch (error) {
      log.error('Error detecting system language:', error)
      return null
    }
  }
}

export default Preference
