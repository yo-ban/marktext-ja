import { app, Menu, type BrowserWindow } from 'electron'
import * as actions from '../actions/file'
import { t } from '../../i18n'

// Built on demand (not at module load) so the labels pick up the UI language,
// which is only known once preferences have loaded.
const buildDockMenu = (): Menu =>
  Menu.buildFromTemplate([
    {
      label: t('menu.dock.open'),
      click(_menuItem, browserWindow) {
        if (browserWindow) {
          actions.openFile(browserWindow as BrowserWindow)
        } else {
          actions.newEditorWindow()
        }
      }
    },
    {
      label: t('menu.dock.clearRecent'),
      click() {
        app.clearRecentDocuments()
      }
    }
  ])

export default buildDockMenu
