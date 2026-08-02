import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, enterSourceMode, waitForMenuReady } from './helpers'

// ---------------------------------------------------------------------------
// Regression: an engine edit still queued in the rAF batch when source mode
// opens must not be lost. The engine batches ops on requestAnimationFrame
// (JSONState._emitStateChange); before the fix, switching to source mode in
// the same frame mounted CodeMirror from the stale `tab.markdown`, and the
// exit handoff (sourceCode.vue onBeforeUnmount -> editor.vue replaceContent)
// then wrote that stale content back over the edit — DOM showed the checkbox
// checked while the document reverted to unchecked. The fix flushes the
// engine in `preferences.SET_MODE` / `TOGGLE_VIEW_MODE` before the flag
// flips.
// ---------------------------------------------------------------------------

const NESTED_TASKS = '- [ ] parent\n\n  - [ ] child1\n  - [ ] child2\n'

test.describe('Source mode opens on flushed engine content', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(NESTED_TASKS, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelectorAll('.editor-component input[type=checkbox]').length
        )
      )
      .toBe(3)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('a checkbox toggled in the same frame as the switch survives the roundtrip', async() => {
    // Pin the race: stand in for a busy frame by deferring rAF callbacks
    // beyond the menu-IPC roundtrip, so the toggle's op is still queued when
    // the mode flips. The fix's flush() applies the batch synchronously and
    // does not depend on the rAF firing (a canceled fake id is a no-op).
    await page.evaluate(() => {
      const w = window as unknown as { __origRaf?: typeof requestAnimationFrame }
      w.__origRaf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        window.setTimeout(() => cb(performance.now()), 300)) as typeof requestAnimationFrame
    })
    await page.click('.editor-component input[type=checkbox] >> nth=0')
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const w = window as unknown as { __origRaf?: typeof requestAnimationFrame }
      if (w.__origRaf) window.requestAnimationFrame = w.__origRaf
    })

    const source = await page.evaluate(() => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror: { getValue(): string } })
        | null
      return cm ? cm.CodeMirror.getValue() : ''
    })
    expect(source).toContain('- [x] parent')
  })
})
