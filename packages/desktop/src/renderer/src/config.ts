export const PATH_SEPARATOR: string = window.path.sep

export const THEME_STYLE_ID = 'ag-theme'
export const COMMON_STYLE_ID = 'ag-common-style'

// Japanese fonts sit between the Latin fonts and the generic family: Latin
// glyphs keep resolving to the Latin fonts (which carry no CJK glyphs), while
// CJK glyphs get an explicit per-OS Japanese font instead of Chromium's
// locale-dependent default (which can pick Chinese-style glyphs).
export const DEFAULT_EDITOR_FONT_FAMILY =
  '"Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, "Yu Gothic UI", Meiryo, "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", sans-serif, Segoe UI Emoji, Apple Color Emoji, "Noto Color Emoji"'
export const DEFAULT_CODE_FONT_FAMILY =
  '"DejaVu Sans Mono", "Source Code Pro", "Droid Sans Mono", "BIZ UDGothic", "MS Gothic", "Noto Sans Mono CJK JP", monospace'
export const DEFAULT_STYLE = Object.freeze({
  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  codeFontSize: '14px',
  hideScrollbar: false,
  theme: 'light'
})

export { railscastsThemes, oneDarkThemes } from '../../common/theme'
