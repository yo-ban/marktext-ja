import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, placeCaretInEditor, typeIntoEditor } from './helpers'

// The picker's emoji table and fuzzy matcher are pulled in by a dynamic import
// the first time it opens, while rendering `:alias:` goes through a small
// generated alias map instead. Neither path is exercised by the unit suites in
// a packaged bundle, where a mis-split chunk is what would break them.
test.describe('Emoji', () => {
  let app: ElectronApplication
  let page: Page

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('renders a written alias as its character', async() => {
    ;({ app, page } = await launchWithMarkdown('Hello :smile: world\n'))

    const marked = page.locator('.editor-component span.mu-emoji-marked-text')
    await expect(marked).toHaveCount(1)
    await expect(marked).toHaveAttribute('data-emoji', '😄')
  })

  test('typing an alias opens the picker and Enter inserts the emoji', async() => {
    ;({ app, page } = await launchWithMarkdown('\n'))
    await placeCaretInEditor(page)
    // The picker follows the caret while it sits inside an `:alias:` token, so
    // the alias has to be typed between both colons — the inline lexer has no
    // emoji token until the closing one is there. Typing here rather than
    // through `typeIntoEditor` keeps the caret where ArrowLeft put it.
    await typeIntoEditor(page, '::')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('smi', { delay: 30 })

    const items = page.locator('.mu-emoji-picker div.item')
    await expect(items.first()).toBeVisible()
    const chosen = await page.locator('.mu-emoji-picker div.item.active').getAttribute('data-label')

    await page.keyboard.press('Enter')

    // Hiding a float parks it off-screen with its list still rendered, so the
    // viewport is what says whether the picker is up.
    await expect(items.first()).not.toBeInViewport()
    const marked = page.locator('.editor-component span.mu-emoji-marked-text')
    await expect(marked).toHaveCount(1)
    await expect(marked).toHaveText(chosen!)
  })
})
