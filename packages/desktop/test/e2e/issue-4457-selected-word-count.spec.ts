import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  enterSourceMode,
  exitSourceMode,
  launchWithMarkdown,
  placeCaretInEditor
} from './helpers'

const COUNTER = '.word-count .text-center-vertical'
const counterText = (page: Page) => page.locator(COUNTER).innerText()

test.describe('selected-text word count (#4457)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('alpha beta gamma\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('shows document / selection counts in WYSIWYG mode and clears on collapse', async() => {
    await placeCaretInEditor(page)
    await page.keyboard.press('ControlOrMeta+A')
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toContain('alpha beta gamma')
    await expect.poll(() => counterText(page)).toMatch(/^W\s+3\s+\/\s+3$/)

    await placeCaretInEditor(page)
    await expect.poll(() => counterText(page)).toMatch(/^W\s+3$/)
  })

  test('tracks the CodeMirror selection in Source Code mode', async() => {
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const host = document.querySelector('.source-code .CodeMirror') as
        | (Element & {
          CodeMirror?: {
            setSelection(anchor: { line: number; ch: number }, focus: { line: number; ch: number }): void
          }
        })
        | null
      host?.CodeMirror?.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 10 })
    })

    await expect.poll(() => counterText(page)).toMatch(/^W\s+3\s+\/\s+2$/)

    await page.evaluate(() => {
      const host = document.querySelector('.source-code .CodeMirror') as
        | (Element & {
          CodeMirror?: { setCursor(cursor: { line: number; ch: number }): void }
        })
        | null
      host?.CodeMirror?.setCursor({ line: 0, ch: 10 })
    })
    await expect.poll(() => counterText(page)).toMatch(/^W\s+3$/)

    await exitSourceMode(page, app)
  })
})
