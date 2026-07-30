import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, placeCaretInEditor, typeIntoEditor } from './helpers'

// KaTeX is pulled in by a dynamic import the first time a document holds math,
// so the first render shows the formula source and a second one replaces it
// once the chunk lands. Only a packaged bundle exercises that hand-off.
test.describe('Math rendering', () => {
  let app: ElectronApplication
  let page: Page

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('block math in an opened document renders through KaTeX', async() => {
    ;({ app, page } = await launchWithMarkdown('$$\n\\frac{1}{2}\n$$\n'))

    const rendered = page.locator('.editor-component .mu-math-preview .katex')
    await expect(rendered.first()).toBeVisible()
  })

  test('inline math typed into the editor renders through KaTeX', async() => {
    ;({ app, page } = await launchWithMarkdown('\n'))
    await placeCaretInEditor(page)
    await typeIntoEditor(page, 'euler $e^{i\\pi}+1=0$ done')

    const rendered = page.locator('.editor-component .mu-math-render .katex')
    await expect(rendered.first()).toBeVisible()
  })
})
