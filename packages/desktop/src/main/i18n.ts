import { getTranslation } from 'common/i18n'
import { BrowserWindow, app } from 'electron'

// Current language setting (can be obtained from config file or user settings)
let currentLanguage = 'en'

/**
 * Gets the translated text.
 */
export function t(key: string, params: Record<string, string | number> = {}): string {
  return getTranslation(key, currentLanguage, params)
}

/**
 * Gets the current language.
 */
export function getCurrentLanguage(): string {
  return currentLanguage
}

/**
 * Ordered system-language candidates for first-start detection (#4322):
 * the OS preference list first (on Windows the display language, where
 * `getLocale()` reports the regional format instead), then Chromium's
 * single locale, then the POSIX locale environment — the only signal in
 * minimal Linux setups, and available even before app-ready where the
 * Electron APIs return nothing.
 */
export function getSystemLanguageCandidates(): string[] {
  const candidates: string[] = []
  try {
    candidates.push(...app.getPreferredSystemLanguages())
  } catch {
    // Not available on this platform / lifecycle stage.
  }
  try {
    candidates.push(app.getLocale())
  } catch {
    // Before app-ready this can be empty; detectSupportedLanguage skips it.
  }
  // POSIX precedence: LC_ALL overrides LC_MESSAGES overrides LANG. Strip the
  // encoding suffix and normalize 'ja_JP.UTF-8' to 'ja-JP'.
  for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const value = process.env[name]
    if (value) {
      candidates.push(value.split('.')[0]!.replace(/_/g, '-'))
    }
  }
  return candidates
}

/**
 * Sets the language.
 */
export function setLanguage(language: string): void {
  currentLanguage = language

  const windows = BrowserWindow.getAllWindows()
  windows.forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('language-changed', language)
    }
  })
}
