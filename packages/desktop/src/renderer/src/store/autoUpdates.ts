import { defineStore } from 'pinia'
import notice from '../services/notification'
import { t } from '../i18n'

export const useAutoUpdatesStore = defineStore('autoUpdates', () => {
  function LISTEN_FOR_UPDATE(): void {
    window.electron.ipcRenderer.on('mt::UPDATE_ERROR', (_e, message) => {
      notice.notify({
        title: t('store.autoUpdates.updateTitle'),
        type: 'error',
        time: 10000,
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_NOT_AVAILABLE', (_e, message) => {
      notice.notify({
        title: t('store.autoUpdates.notAvailableTitle'),
        type: 'primary',
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_DOWNLOADED', (_e, message) => {
      notice.notify({
        title: t('store.autoUpdates.downloadedTitle'),
        type: 'info',
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_AVAILABLE', (_e, message) => {
      notice
        .notify({
          title: t('store.autoUpdates.availableTitle'),
          type: 'primary',
          message: String(message ?? ''),
          showConfirm: true
        })
        .then(() => {
          const needUpdate = true
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
        .catch(() => {
          const needUpdate = false
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
    })
  }

  return { LISTEN_FOR_UPDATE }
})
