import { describe, expect, it } from 'vitest'
import { detectSupportedLanguage } from 'common/i18n'

// First-start UI language detection (#4322): an ordered candidate list
// (preferred system languages, Chromium locale, POSIX env) matched against
// the locales the app actually ships.

describe('detectSupportedLanguage', () => {
  it('matches a full supported tag', () => {
    expect(detectSupportedLanguage(['zh-CN'])).toBe('zh-CN')
    expect(detectSupportedLanguage(['ja'])).toBe('ja')
  })

  it('falls back to the primary subtag for regional variants', () => {
    expect(detectSupportedLanguage(['ja-JP'])).toBe('ja')
    expect(detectSupportedLanguage(['pt-BR'])).toBe('pt')
    expect(detectSupportedLanguage(['en-GB'])).toBe('en')
  })

  it('honors candidate order over match quality', () => {
    // 'en-AU' is only a primary-subtag match, but it is the FIRST preference.
    expect(detectSupportedLanguage(['en-AU', 'ja'])).toBe('en')
  })

  it('routes Traditional-script Chinese to zh-TW, never zh-CN', () => {
    expect(detectSupportedLanguage(['zh-HK'])).toBe('zh-TW')
    expect(detectSupportedLanguage(['zh-Hant-TW'])).toBe('zh-TW')
    expect(detectSupportedLanguage(['zh-MO'])).toBe('zh-TW')
    expect(detectSupportedLanguage(['zh'])).toBe('zh-CN')
  })

  it('parses LANG-style underscore tags', () => {
    // getSystemLanguageCandidates normalizes 'ja_JP.UTF-8' to 'ja-JP', but a
    // raw underscore tag must still resolve via the primary subtag.
    expect(detectSupportedLanguage(['ja_JP'])).toBe('ja')
  })

  it('skips empty, C and POSIX candidates instead of matching everything', () => {
    // An empty tag primary-matched every language via startsWith('') once.
    expect(detectSupportedLanguage(['', 'C', 'POSIX'])).toBe(null)
    expect(detectSupportedLanguage(['', 'ko-KR'])).toBe('ko')
  })

  it('returns null when no shipped locale matches', () => {
    // 'ru' has no locale file — offering it rendered raw translation keys.
    expect(detectSupportedLanguage(['ru-RU', 'ru'])).toBe(null)
    expect(detectSupportedLanguage([])).toBe(null)
  })
})
