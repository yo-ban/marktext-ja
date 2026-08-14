import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { defaultUiLanguage, launchElectron, localeString } from './helpers'

test.describe('Check Launch MarkText', () => {
  let app: ElectronApplication
  let page: Page
  const lang = defaultUiLanguage()

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Empty MarkText', async() => {
    const title = await page.title()
    expect(/^MarkText|Untitled-1 - MarkText$/.test(title)).toBeTruthy()
  })

  test('shows the welcome screen and sidebar on a blank first launch', async() => {
    await expect(page.locator('.recent-files-projects')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: localeString(lang, 'recent.newFile') })).toBeVisible()
    const welcome = page.locator('.recent-files-projects')
    await expect(
      welcome.getByRole('button', { name: localeString(lang, 'commands.file.openFile') })
    ).toBeVisible()
    await expect(
      welcome.getByRole('button', { name: localeString(lang, 'commands.file.openFolder') })
    ).toBeVisible()
    await expect(page.locator('.side-bar')).toBeVisible()
    await expect(page.locator('.folders-section')).toBeVisible()
    await expect(
      page.locator('.folders-section').getByTitle(localeString(lang, 'sideBar.tree.openFolder'))
    ).toBeVisible()
  })
})
