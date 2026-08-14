import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Element Plus 2 defaults `--el-fill-color-blank` to white and
// `--el-text-color-regular` to a dark grey. Those tokens are re-emitted on
// :root by each component stylesheet, so mapping them on `body` (not :root)
// is what keeps dark themes from painting white inputs and unreadable radios.

const __dirname = dirname(fileURLToPath(import.meta.url))
const INDEX_CSS = readFileSync(
  resolve(__dirname, '../../../src/renderer/src/assets/styles/index.css'),
  'utf8'
)
const ONE_DARK = readFileSync(
  resolve(__dirname, '../../../src/renderer/src/assets/themes/one-dark.theme.css'),
  'utf8'
)

const bodyBlock = (css: string): string => {
  const match = css.match(/body\s*\{([\s\S]*?)\n\}/)
  if (!match) throw new Error('no body { } block')
  // The first body block is `html, body`; we want the standalone `body` rule.
  const all = [...css.matchAll(/(?:^|\n)body\s*\{([\s\S]*?)\n\}/g)]
  const standalone = all.find((m) => !css.slice(Math.max(0, (m.index ?? 0) - 10), m.index).includes('html'))
  return (standalone?.[1] ?? match[1]).trim()
}

describe('Element Plus theme token mapping', () => {
  it('maps EP fill and text tokens on body so component styles cannot reset :root', () => {
    const body = bodyBlock(INDEX_CSS)
    expect(body).toMatch(/--el-fill-color-blank:\s*var\(\s*--editorBgColor\s*\)/)
    expect(body).toMatch(/--el-text-color-regular:\s*var\(\s*--editorColor\s*\)/)
    expect(body).toMatch(/--el-input-bg-color:\s*var\(\s*--inputBgColor\s*\)/)
    expect(body).toMatch(/--el-fill-color-light:\s*var\(\s*--floatHoverColor\s*\)/)
  })

  it('themes radio labels even when they are not checked', () => {
    expect(INDEX_CSS).toMatch(/\.el-radio(?:__label)?[^{]*\{[^}]*color:\s*var\(\s*--editorColor\s*\)/s)
  })
})

describe('one-dark task checkbox contrast', () => {
  it('does not paint a white checkmark on the light editorColor fill', () => {
    expect(ONE_DARK).toMatch(
      /mu-checkbox-checked::before[\s\S]{0,80}background-color:\s*var\(\s*--themeColor\s*\)/
    )
    const after = ONE_DARK.match(/input::after\s*\{([\s\S]*?)\n\}/)
    expect(after?.[1]).toMatch(/border:\s*2px solid var\(\s*--editorBgColor\s*\)/)
    expect(after?.[1]).not.toMatch(/#fff|#ffffff|\bwhite\b/i)
  })
})
