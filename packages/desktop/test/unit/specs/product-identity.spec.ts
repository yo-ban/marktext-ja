import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_ID, GITHUB_REPO_URL, PRODUCT_NAME, PRODUCT_SLUG } from '@shared/product'

const currentDir = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(currentDir, '../../..')
const repositoryRoot = resolve(desktopRoot, '../..')

const readDesktopFile = (relativePath: string): string => {
  return readFileSync(resolve(desktopRoot, relativePath), 'utf8')
}

describe('MarkText-ja product identity', () => {
  it('uses a distinct application identity and update repository', () => {
    expect(PRODUCT_NAME).toBe('MarkText-ja')
    expect(PRODUCT_SLUG).toBe('marktext-ja')
    expect(APP_ID).toBe('com.github.yo-ban.marktext-ja')
    expect(GITHUB_REPO_URL).toBe('https://github.com/yo-ban/marktext-ja')

    const builderConfig = readDesktopFile('electron-builder.yml')
    expect(builderConfig).toMatch(/^appId: com\.github\.yo-ban\.marktext-ja$/m)
    expect(builderConfig).toMatch(/^productName: MarkText-ja$/m)
    expect(builderConfig).toMatch(/^\s+owner: yo-ban$/m)
    expect(builderConfig).toMatch(/^\s+repo: marktext-ja$/m)
    expect(builderConfig).toMatch(/^\s+executableName: marktext-ja$/m)
    expect(builderConfig).not.toContain('com.github.marktext.marktext')
  })

  it('keeps package scripts and metadata on the fork package', () => {
    const desktopPackage = JSON.parse(readDesktopFile('package.json')) as {
      name: string
      productName: string
      desktopName: string
      homepage: string
      repository: { url: string }
    }
    const rootPackageText = readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')

    expect(desktopPackage).toMatchObject({
      name: PRODUCT_SLUG,
      productName: PRODUCT_NAME,
      desktopName: 'marktext-ja.desktop',
      homepage: GITHUB_REPO_URL,
      repository: { url: `git+${GITHUB_REPO_URL}.git` }
    })
    expect(rootPackageText).toContain('pnpm --filter marktext-ja')
    expect(rootPackageText).not.toMatch(/pnpm --filter marktext(?:\s|")/)
  })

  it('uses an isolated and uninstall-safe Windows file association', () => {
    const installer = readDesktopFile('build/windows/installer.nsh')

    expect(installer).toContain('MarkTextJa.Document')
    expect(installer).toContain('$INSTDIR\\marktext-ja.exe')
    expect(installer).toContain('$APPDATA\\marktext-ja')
    const safeExtensionRemoval =
      'DeleteRegValue HKCU "Software\\Classes\\' + '$' + '{EXT}" ""'
    expect(installer).toContain(safeExtensionRemoval)
    expect(installer).not.toContain('MarkText.Document')
    expect(installer).not.toMatch(/DeleteRegKey HKCU "Software\\Classes\\\.(?:md|markdown|mmd)/)
  })

  it('brands every shipped locale as MarkText-ja', () => {
    const localesDirectory = resolve(desktopRoot, 'static/locales')
    const sourceLocales = readdirSync(localesDirectory).filter(
      (name) => name.endsWith('.json') && !name.endsWith('.min.json')
    )

    for (const localeName of sourceLocales) {
      const locale = JSON.parse(readFileSync(resolve(localesDirectory, localeName), 'utf8')) as {
        menu?: { marktext?: { title?: string } }
        error?: { otherInstanceDetected?: string }
      }
      expect(locale.menu?.marktext?.title, localeName).toBe(PRODUCT_NAME)
      expect(locale.error?.otherInstanceDetected, localeName).toContain(PRODUCT_NAME)
    }
  })
})
