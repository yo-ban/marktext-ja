import { beforeEach, describe, expect, it, vi } from 'vitest'

const { buildFromTemplate, setApplicationMenu, onInternalChannel } = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(() => ({ getMenuItemById: vi.fn() })),
  setApplicationMenu: vi.fn(),
  onInternalChannel: vi.fn()
}))

vi.mock('electron', () => ({
  app: { addRecentDocument: vi.fn(), clearRecentDocuments: vi.fn() },
  ipcMain: { on: vi.fn(), handle: vi.fn(), emit: vi.fn() },
  Menu: { buildFromTemplate, setApplicationMenu, getApplicationMenu: vi.fn() }
}))

vi.mock('common/filesystem', () => ({
  ensureDirSync: vi.fn(),
  isDirectory2: () => false,
  isFile2: () => false
}))

vi.mock('main_renderer/config', () => ({ isLinux: true, isOsx: false, isWindows: false }))
vi.mock('main_renderer/menu/actions/edit', () => ({ updateSidebarMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/format', () => ({ updateFormatMenu: vi.fn() }))
vi.mock('main_renderer/menu/actions/paragraph', () => ({ updateSelectionMenus: vi.fn() }))
vi.mock('main_renderer/menu/actions/view', () => ({ viewLayoutChanged: vi.fn() }))
vi.mock('main_renderer/utils/internalIpc', () => ({ onInternalChannel }))
vi.mock('main_renderer/i18n.js', () => ({ setLanguage: vi.fn() }))
vi.mock('main_renderer/menu/templates', () => ({
  default: vi.fn(() => []),
  configSettingMenu: vi.fn(() => [])
}))

import AppMenu, { MenuType } from 'main_renderer/menu'
import type Preference from 'main_renderer/preferences'
import type Keybindings from 'main_renderer/keyboard/shortcutHandler'

const makeAppMenu = () => {
  const preferences = { getItem: () => 'en' } as unknown as Preference
  const keybindings = { registerEditorKeyHandlers: vi.fn() } as unknown as Keybindings
  return new AppMenu(preferences, keybindings, '/tmp/mt-menu-performance')
}

describe('AppMenu lightweight updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates nested theme items without rebuilding the application menu', () => {
    const appMenu = makeAppMenu()
    const follow = { id: 'follow-system-theme', type: 'checkbox', checked: false }
    const hint = {
      id: 'follow-system-theme-disabled-hint',
      type: 'normal',
      visible: false
    }
    const light = { id: 'light', type: 'radio', checked: true, enabled: true }
    const dark = { id: 'dark', type: 'radio', checked: false, enabled: true }
    const themeMenu = {
      submenu: {
        items: [
          follow,
          hint,
          { type: 'submenu', submenu: { items: [light] } },
          { type: 'submenu', submenu: { items: [dark] } }
        ]
      }
    }
    const menu = {
      getMenuItemById: (id: string) => (id === 'themeMenu' ? themeMenu : null)
    }
    appMenu.windowMenus.set(1, { menu, type: MenuType.EDITOR } as never)
    const rebuild = vi.spyOn(appMenu, 'updateAppMenu')

    appMenu.updateThemeMenu({ theme: 'dark', followSystemTheme: true })

    expect(follow.checked).toBe(true)
    expect(hint.visible).toBe(true)
    expect(light).toMatchObject({ checked: false, enabled: false })
    expect(dark).toMatchObject({ checked: true, enabled: false })
    expect(rebuild).not.toHaveBeenCalled()
    expect(setApplicationMenu).not.toHaveBeenCalled()
  })

  it('does not rebuild when the recent document is already first', () => {
    const appMenu = makeAppMenu()
    vi.spyOn(appMenu, 'getRecentlyUsedDocuments').mockReturnValue(['/notes/current.md'])
    // Seed the list represented by the currently installed menus.
    appMenu.updateAppMenu(['/notes/current.md'])
    const rebuild = vi.spyOn(appMenu, 'updateAppMenu')

    appMenu.addRecentlyUsedDocument('/notes/current.md')

    expect(rebuild).not.toHaveBeenCalled()
  })

  it('still refreshes when a stale recent entry disappeared from disk', () => {
    const appMenu = makeAppMenu()
    appMenu.updateAppMenu(['/notes/current.md', '/notes/deleted.md'])
    vi.spyOn(appMenu, 'getRecentlyUsedDocuments').mockReturnValue(['/notes/current.md'])
    const rebuild = vi.spyOn(appMenu, 'updateAppMenu')

    appMenu.addRecentlyUsedDocument('/notes/current.md')

    expect(rebuild).toHaveBeenCalledWith(['/notes/current.md'])
  })

  it('routes theme preference broadcasts through the lightweight updater', async() => {
    const appMenu = makeAppMenu()
    const themeUpdate = vi.spyOn(appMenu, 'updateThemeMenu')
    const rebuild = vi.spyOn(appMenu, 'updateAppMenu')
    const registration = onInternalChannel.mock.calls.find(
      ([channel]) => channel === 'broadcast-preferences-changed'
    )
    const handler = registration?.[1] as
      | ((preferences: { theme?: string; followSystemTheme?: boolean }) => Promise<void>)
      | undefined

    expect(handler).toBeTypeOf('function')
    await handler?.({ theme: 'dark' })

    expect(themeUpdate).toHaveBeenCalledWith({ theme: 'dark', followSystemTheme: undefined })
    expect(rebuild).not.toHaveBeenCalled()
  })
})
