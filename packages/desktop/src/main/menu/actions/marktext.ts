import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Menu, app, dialog, ipcMain } from 'electron'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'
import { isOsx } from '../../config'
import { t } from '../../i18n'

let runningUpdate = false
let win: BrowserWindow | null = null

autoUpdater.autoDownload = false

autoUpdater.on('error', (error: Error) => {
  if (win) {
    // Preserve the JS behavior: it tolerated `null` here; the typed event
    // shape doesn't, but the same defensive code below stays in place.
    const err = error as Error | null
    win.webContents.send(
      'mt::UPDATE_ERROR',
      err === null ? 'Error: unknown' : (err.message || err).toString()
    )
  }
})

autoUpdater.on('update-available', (_info) => {
  if (win) {
    win.webContents.send('mt::UPDATE_AVAILABLE', t('dialog.updateAvailableMessage'))
  }
  runningUpdate = false
})

autoUpdater.on('update-not-available', (_info) => {
  if (win) {
    win.webContents.send('mt::UPDATE_NOT_AVAILABLE', t('dialog.updateNotAvailableMessage'))
  }
  runningUpdate = false
})

autoUpdater.on('update-downloaded', async(_event) => {
  if (win) {
    win.webContents.send('mt::UPDATE_DOWNLOADED', t('dialog.updateDownloadedMessage'))
  }

  // Never quitAndInstall() directly: it tears the windows down without the
  // unsaved-files flow, silently destroying open documents. A normal
  // app.quit() runs every window's close prompt, and electron-updater's
  // autoInstallOnAppQuit (default on) installs the downloaded update once the
  // app exits — including a later, user-initiated quit if they pick "Later".
  const options = {
    type: 'info' as const,
    buttons: [t('dialog.updateInstallNow'), t('dialog.updateLater')],
    defaultId: 0,
    cancelId: 1,
    message: t('dialog.updateDownloadedMessage'),
    detail: t('dialog.updateDownloadedDetail'),
    noLink: true
  }
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  if (response === 0) {
    app.quit()
  }
})

ipcMain.on('mt::NEED_UPDATE', (_e, { needUpdate }: { needUpdate: boolean }) => {
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::check-for-update', (e) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender)
  checkUpdates(senderWin)
})

// --------------------------------------------------------

export const userSetting = (): void => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = (browserWindow: BrowserWindow | null): void => {
  if (!runningUpdate) {
    runningUpdate = true
    win = browserWindow
    autoUpdater.checkForUpdates()
  }
}

export const osxHide = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hide:')
  }
}

export const osxHideAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hideOtherApplications:')
  }
}

export const osxShowAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('unhideAllApplications:')
  }
}

// --- Commands -------------------------------------------------------------

export const loadMarktextCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.MT_HIDE, osxHide)
  commandManager.add(COMMANDS.MT_HIDE_OTHERS, osxHideAll)
}
