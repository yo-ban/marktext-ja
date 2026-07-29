import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import ts from 'typescript'
import { ref, computed, nextTick } from 'vue'

// Regression guard for the rename dialog firing on an IME commit: pressing
// Enter to commit a Japanese composition confirmed the rename with the
// half-typed name. The template listened on keyup.enter — but the Enter that
// commits a composition reaches keyup only after compositionend, when
// isComposing is false again, so no keyup-side guard can work. The fix listens
// on keydown (isComposing still true there) and ignores composing Enters.
//
// Same runtime-compile approach as search-prefill.spec.ts: the unit runner has
// no @vitejs/plugin-vue, so compile the real <script setup>, inject stubs and
// drive the actual confirm() binding.

const here = dirname(fileURLToPath(import.meta.url))
const vuePath = resolve(here, '../../../src/renderer/src/components/rename/index.vue')

interface Bindings {
  showRename: { value: boolean }
  tempName: { value: string }
  confirm: (event?: Event) => void
}

const loadComponent = (deps: Record<string, unknown>) => {
  const src = readFileSync(vuePath, 'utf8')

  // The template must not re-arm the keyup-era bug silently.
  expect(src).toContain('@keydown.enter="confirm"')
  expect(src).not.toContain('@keyup.enter')

  const { descriptor } = parse(src)
  const compiled = compileScript(descriptor, { id: 'test' })
  const noImports = compiled.content
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
  const js = ts.transpileModule(noImports, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    '__deps',
    'exports',
    'module',
    `const { _defineComponent, ref, computed, onMounted, onBeforeUnmount,
      nextTick, bus, useEditorStore, Check } = __deps
    ${js}
    return module.exports`
  ) as (deps: Record<string, unknown>, exports: object, module: object) => {
    default: { setup: (props: unknown, ctx: { expose: () => void }) => Bindings }
  }
  const m = { exports: {} as Record<string, unknown> }
  return factory(deps, m.exports, m).default
}

const makeBindings = () => {
  const RENAME = vi.fn()
  const deps = {
    _defineComponent: (o: unknown) => o,
    ref,
    computed,
    nextTick,
    onMounted: vi.fn(),
    onBeforeUnmount: vi.fn(),
    bus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    useEditorStore: () => ({ RENAME, currentFile: { filename: 'old.md' } }),
    Check: {}
  }
  const component = loadComponent(deps)
  const bindings = component.setup({}, { expose: () => {} })
  return { bindings, RENAME }
}

describe('rename dialog vs IME composition', () => {
  it('ignores the Enter that commits a composition (isComposing keydown)', () => {
    const { bindings, RENAME } = makeBindings()
    bindings.showRename.value = true
    bindings.tempName.value = '日本語'

    bindings.confirm(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))

    expect(RENAME).not.toHaveBeenCalled()
    expect(bindings.showRename.value).toBe(true)
  })

  it('confirms on a plain Enter keydown', () => {
    const { bindings, RENAME } = makeBindings()
    bindings.showRename.value = true
    bindings.tempName.value = '日本語.md'

    bindings.confirm(new KeyboardEvent('keydown', { key: 'Enter', isComposing: false }))

    expect(RENAME).toHaveBeenCalledWith('日本語.md')
    expect(bindings.showRename.value).toBe(false)
  })

  it('confirms via the icon click (no keyboard event)', () => {
    const { bindings, RENAME } = makeBindings()
    bindings.showRename.value = true
    bindings.tempName.value = 'clicked.md'

    bindings.confirm(new MouseEvent('click'))

    expect(RENAME).toHaveBeenCalledWith('clicked.md')
    expect(bindings.showRename.value).toBe(false)
  })
})
