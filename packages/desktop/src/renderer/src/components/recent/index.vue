<template>
  <div class="recent-files-projects">
    <div class="welcome">
      <p class="hint">
        {{ t('recent.hint') }}
      </p>
      <empty-action-list :actions="actions" />
      <p class="drop">
        {{ t('recent.dropHint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Document, DocumentAdd, FolderOpened } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import EmptyActionList, { type EmptyAction } from '@/components/common/emptyActionList.vue'

const { t } = useI18n()
const editorStore = useEditorStore()

const actions = computed<EmptyAction[]>(() => [
  {
    label: t('recent.newFile'),
    icon: DocumentAdd,
    commandId: 'file.new-tab',
    fallbackAccelerator: 'CmdOrCtrl+T',
    run: () => editorStore.NEW_UNTITLED_TAB({})
  },
  {
    label: t('commands.file.openFile'),
    icon: Document,
    commandId: 'file.open-file',
    fallbackAccelerator: 'CmdOrCtrl+O',
    run: () => window.electron.ipcRenderer.send('mt::cmd-open-file')
  },
  {
    label: t('commands.file.openFolder'),
    icon: FolderOpened,
    commandId: 'file.open-folder',
    fallbackAccelerator: 'CmdOrCtrl+Shift+O',
    run: () => window.electron.ipcRenderer.send('mt::cmd-open-folder')
  }
])
</script>

<style scoped>
.recent-files-projects {
  background: var(--editorBgColor);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: min(320px, calc(100% - 48px));
  color: var(--editorColor);
}

.hint,
.drop {
  margin: 0;
  text-align: center;
}

.hint {
  margin-bottom: 20px;
  color: var(--editorColor50);
  font-size: 14px;
  line-height: 1.6;
}

.drop {
  margin-top: 28px;
  color: var(--editorColor30);
  font-size: 12px;
}
</style>
