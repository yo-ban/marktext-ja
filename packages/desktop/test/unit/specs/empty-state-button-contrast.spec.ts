import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// #4774: empty-state actions used to paint `color: var(--themeColor)` on
// `background-color: var(--itemBgColor)`, which was unreadable in several
// themes. They now reuse the surface's body text token (editor / sidebar)
// so they stay as readable as the surrounding copy, without a foreign
// primary-green CTA.

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER = resolve(__dirname, '../../../src/renderer/src')
const THEME_DIR = resolve(RENDERER, 'assets/themes')
const BASE_CSS = resolve(RENDERER, 'assets/styles/index.css')

type Rgb = [number, number, number]
type Rgba = [number, number, number, number]

const parseVars = (css: string): Record<string, string> => {
  const vars: Record<string, string> = {}
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) vars[m[1]] = m[2].trim()
  return vars
}

const resolveVar = (value: string, vars: Record<string, string>): string => {
  let v = value
  let guard = 0
  while (/var\(/.test(v) && guard++ < 20) {
    v = v
      .replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, name) => vars[name] ?? '')
      .trim()
  }
  return v
}

const toRgba = (raw: string): Rgba | null => {
  const str = raw.trim()
  let m: RegExpMatchArray | null
  if ((m = str.match(/^#([0-9a-fA-F]{3})$/))) {
    const h = m[1]
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      1
    ]
  }
  if ((m = str.match(/^#([0-9a-fA-F]{6})$/))) {
    const h = m[1]
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      1
    ]
  }
  if ((m = str.match(/^rgba?\(([^)]+)\)/))) {
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]
  }
  // Some themes use a gradient for the primary button background; the solid
  // stop is representative for a contrast estimate.
  if (/^linear-gradient/.test(str)) {
    const h = str.match(/#([0-9a-fA-F]{6})/)
    if (h) return toRgba('#' + h[1])
  }
  return null
}

// Composite a translucent colour over an opaque backdrop.
const over = (fg: Rgba, bg: Rgb): Rgb => {
  const a = fg[3]
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a)
  ]
}

const relLuminance = ([r, g, b]: Rgb): number => {
  const f = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const contrast = (a: Rgb, b: Rgb): number => {
  const l1 = relLuminance(a)
  const l2 = relLuminance(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// Resolve a (foreground var, background var) pairing to its rendered WCAG
// contrast for a given theme, compositing any translucent colours over the
// surface the button sits on.
const pairContrast = (
  fgVar: string,
  bgVar: string,
  surfaceVar: string,
  vars: Record<string, string>
): number => {
  const surface = toRgba(resolveVar(`var(${surfaceVar})`, vars))
  const surfaceRgb: Rgb = surface ? [surface[0], surface[1], surface[2]] : [255, 255, 255]
  const bgRaw = toRgba(resolveVar(`var(${bgVar})`, vars))
  const fgRaw = toRgba(resolveVar(`var(${fgVar})`, vars))
  if (!bgRaw || !fgRaw) throw new Error(`unresolved colour ${fgVar}/${bgVar}`)
  const bg = bgRaw[3] < 1 ? over(bgRaw, surfaceRgb) : [bgRaw[0], bgRaw[1], bgRaw[2]] as Rgb
  const fg = fgRaw[3] < 1 ? over(fgRaw, bg) : [fgRaw[0], fgRaw[1], fgRaw[2]] as Rgb
  return contrast(fg, bg)
}

// Label colour of a rule whose last selector subject is `.empty-action`.
const extractFgVar = (css: string, requireSidebar: boolean): string => {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(css))) {
    const selector = m[1]
    const body = m[2]
    if (/:hover|:focus/.test(selector)) continue
    const subject = selector.trim().split(/[\s>]+/).pop()
    if (subject !== '.empty-action') continue
    const isSidebar = selector.includes('.sidebar')
    if (isSidebar !== requireSidebar) continue
    const fg = body.match(/(?<![-\w])color:\s*var\(\s*(--[\w-]+)/)
    if (fg) return fg[1]
  }
  throw new Error(`no .empty-action color var (sidebar=${requireSidebar})`)
}

const baseVars = parseVars(readFileSync(BASE_CSS, 'utf8'))
const themeFiles = readdirSync(THEME_DIR).filter((f) => f.endsWith('.theme.css'))
const EMPTY_ACTION_CSS = readFileSync(
  resolve(RENDERER, 'components/common/emptyActionList.vue'),
  'utf8'
)

const TONES = [
  {
    name: 'editor welcome actions',
    fgVar: extractFgVar(EMPTY_ACTION_CSS, false),
    expectedFg: '--editorColor',
    surfaceVar: '--editorBgColor',
    bodyFg: '--editorColor'
  },
  {
    name: 'sidebar empty actions',
    fgVar: extractFgVar(EMPTY_ACTION_CSS, true),
    expectedFg: '--sideBarColor',
    surfaceVar: '--sideBarBgColor',
    bodyFg: '--sideBarColor'
  }
]

describe('empty-state action readability (#4774)', () => {
  it('found theme files and the shared empty-action list', () => {
    expect(themeFiles.length).toBeGreaterThan(20)
    expect(EMPTY_ACTION_CSS).toContain('.empty-action')
  })

  for (const tone of TONES) {
    it(`${tone.name} use the surface's body text colour, not the theme accent`, () => {
      expect(tone.fgVar).toBe(tone.expectedFg)
      expect(tone.fgVar).not.toBe('--themeColor')
    })

    it(`${tone.name} stay at least as readable as body text, in every theme`, () => {
      const failures: string[] = []

      for (const file of themeFiles) {
        const vars = {
          ...baseVars,
          ...parseVars(readFileSync(resolve(THEME_DIR, file), 'utf8'))
        }
        const actionContrast = pairContrast(tone.fgVar, tone.surfaceVar, tone.surfaceVar, vars)
        const bodyContrast = pairContrast(tone.bodyFg, tone.surfaceVar, tone.surfaceVar, vars)
        if (actionContrast < bodyContrast - 0.01) {
          failures.push(
            `${file.replace('.theme.css', '')}: action ${actionContrast.toFixed(2)} < body ${bodyContrast.toFixed(2)}`
          )
        }
      }

      expect(failures, `\n  ${failures.join('\n  ')}\n`).toEqual([])
    })
  }
})
