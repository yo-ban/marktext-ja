import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Preferences toggles used to style Element Plus's old `::after` knob. EP 2.x
// draws the knob as `.el-switch__action` in `--el-color-white`, and the OFF
// track is transparent, so light themes showed a white disc on a white page.

const __dirname = dirname(fileURLToPath(import.meta.url))
const SWITCH_CSS = readFileSync(
  resolve(__dirname, '../../../src/renderer/src/prefComponents/common/bool/index.vue'),
  'utf8'
)

const offActionBackground = (css: string): string => {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(css))) {
    const selector = m[1]
    const body = m[2]
    if (!/:not\(\s*\.is-checked\s*\)/.test(selector)) continue
    if (!selector.includes('.el-switch__action')) continue
    const bg = body.match(/background(?:-color)?:\s*([^;]+)/)
    if (bg) return bg[1].trim()
  }
  throw new Error('no OFF-state .el-switch__action background')
}

describe('preferences switch knob contrast', () => {
  it('colours the Element Plus action knob, not the obsolete ::after pseudo', () => {
    expect(SWITCH_CSS).toMatch(/:not\(\s*\.is-checked\s*\).*el-switch__action/s)
    expect(SWITCH_CSS).not.toMatch(/:not\(\s*\.is-checked\s*\).*el-switch__core::after/s)
  })

  it('uses the outline token so the OFF knob is not white-on-white', () => {
    const bg = offActionBackground(SWITCH_CSS)
    expect(bg).toMatch(/var\(\s*--iconColor\s*\)/)
    expect(bg).not.toMatch(/#fff|#ffffff|white|--el-color-white/i)
  })
})
