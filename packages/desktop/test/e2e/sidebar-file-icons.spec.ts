import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// The file-icons rule database and its stylesheet (~270KB) are imported on
// demand by sideBar/fileIconClass.ts to keep them out of the startup bundle, so
// tree rows render an empty placeholder for the first few frames. This pins the
// part that can silently break: the icon classes must actually arrive, and the
// stylesheet has to arrive with them.
test.describe('Side bar file icons load on demand', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    // The tree only lists markdown files, so open a folder that has one. A
    // folder passed on the command line opens in a *new* window
    // (`openFolderInNewWindow`), which is not the window Playwright hands back,
    // so drive the same internal channel the sidebar's "open folder" uses and
    // target the window under test explicitly.
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2etest-icons-'))
    fs.writeFileSync(path.join(folder, 'notes.md'), '# notes\n')
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
    await app.evaluate(({ ipcMain, BrowserWindow }, pathname) => {
      const win = BrowserWindow.getAllWindows()[0]
      ipcMain.emit('app-open-directory-by-id', win.id, pathname, true)
    }, folder)
    await page.waitForSelector('.side-bar-file', { timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('a markdown row gets its icon class and the icon font styles', async() => {
    const icon = page.locator('.side-bar-file .file-icon').first()
    await expect(icon).toHaveClass(/markdown-icon/, { timeout: 10000 })

    // The placeholder width is dropped once the real class lands.
    await expect(icon).not.toHaveClass(/icon-pending/)

    // The lazily-injected stylesheet is what turns the class into a glyph.
    const glyph = await icon.evaluate(
      (el) => getComputedStyle(el, '::before').content
    )
    expect(glyph).not.toBe('none')
    expect(glyph).not.toBe('')
  })
})
