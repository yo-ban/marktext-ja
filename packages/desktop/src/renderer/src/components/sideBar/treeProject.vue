<template>
  <div class="project-tree">
    <div
      class="title"
      :title="tree.pathname"
      @contextmenu.prevent="handleRootContextMenu"
    >
      <el-icon
        class="icon-arrow"
        :class="{ fold: collapsed }"
        :size="12"
        @click.stop="toggle"
      >
        <ArrowRight />
      </el-icon>
      <span
        class="default-cursor text-overflow"
        @click.stop="toggle"
      >{{ tree.name }}</span>
      <a
        href="javascript:;"
        :title="t('sideBar.tree.closeFolder')"
        @click.stop="close"
      >
        <el-icon :size="14">
          <Close />
        </el-icon>
      </a>
    </div>
    <div
      v-show="!collapsed"
      class="tree-wrapper"
    >
      <folder
        v-for="child of tree.folders"
        :key="child.id"
        :folder="child"
        :depth="0"
      />
      <input
        v-show="createCacheDirname === tree.pathname"
        ref="input"
        v-model="createName"
        :placeholder="t('sideBar.tree.fileNamePlaceholder')"
        type="text"
        class="new-input"
        :style="{ 'margin-left': '15px' }"
        @keydown.enter="handleInputEnter"
      >
      <file
        v-for="file of tree.files"
        :key="file.id"
        :file="file"
        :depth="0"
      />
      <div
        v-if="
          tree.files.length === 0 &&
            tree.folders.length === 0 &&
            createCacheDirname !== tree.pathname
        "
        class="empty-project"
      >
        <span>{{ t('sideBar.tree.emptyProject') }}</span>
        <empty-action-list
          tone="sidebar"
          :show-shortcuts="false"
          :actions="createFileActions"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import Folder from './treeFolder.vue'
import File from './treeFile.vue'
import EmptyActionList, { type EmptyAction } from '@/components/common/emptyActionList.vue'
import bus from '../../bus'
import { showContextMenu } from '../../contextMenu/sideBar'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Close, DocumentAdd } from '@element-plus/icons-vue'
import type { TreeNode } from './types'

const { t } = useI18n()

const props = defineProps<{
  tree: TreeNode
}>()

const emit = defineEmits<{
  close: []
}>()

const collapsed = ref(false)
const createName = ref('')
const input = ref<HTMLInputElement | null>(null)

const projectStore = useProjectStore()
const { createCache, clipboard } = storeToRefs(projectStore)

const createCacheDirname = computed<string | undefined>(() => {
  const cache = createCache.value as { dirname?: string }
  return cache.dirname
})

const createFileActions = computed<EmptyAction[]>(() => [
  {
    label: t('sideBar.tree.createFile'),
    icon: DocumentAdd,
    run: () => createFile()
  }
])

const createFile = (): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.tree)
  bus.emit('SIDEBAR::new', 'file')
}

const handleRootContextMenu = (event: MouseEvent): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.tree)
  showContextMenu(event, !!clipboard.value, { isProjectRoot: true })
}

const toggle = (): void => {
  collapsed.value = !collapsed.value
}

const close = (): void => {
  emit('close')
}

const handleInputFocus = (): void => {
  if (createCacheDirname.value !== props.tree.pathname) return
  collapsed.value = false
  nextTick(() => {
    if (input.value) {
      input.value.focus()
      createName.value = ''
    }
  })
}

const handleInputEnter = (event: KeyboardEvent): void => {
  if (event.isComposing) {
    return
  }
  projectStore.CREATE_FILE_DIRECTORY(createName.value)
}

onMounted(() => {
  bus.on('SIDEBAR::show-new-input', handleInputFocus)
})

onBeforeUnmount(() => {
  bus.off('SIDEBAR::show-new-input', handleInputFocus)
})
</script>

<style scoped>
.icon-arrow {
  margin-right: 5px;
  transition: transform 0.25s ease-out;
  transform: rotate(90deg);
  color: var(--sideBarTextColor);
  cursor: pointer;
}

.icon-arrow.fold {
  transform: rotate(0);
}

.project-tree > .title {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
  padding-left: 10px;
  padding-right: 15px;
  display: flex;
  align-items: center;
}

.project-tree > .title > span {
  flex: 1;
  user-select: none;
}

.project-tree > .title > a {
  display: none;
  text-decoration: none;
  color: var(--sideBarColor);
  margin-left: 8px;
  line-height: 0;
}

.project-tree > .title:hover > a,
.project-tree > .title > a:hover {
  display: flex;
  align-items: center;
}

.project-tree > .title > a:hover {
  color: var(--highlightThemeColor);
}

.default-cursor {
  cursor: pointer;
}

.new-input {
  outline: none;
  height: 22px;
  margin: 5px 0;
  padding: 0 6px;
  color: var(--sideBarColor);
  border: 1px solid var(--floatBorderColor);
  background: var(--inputBgColor);
  width: calc(100% - 45px);
  border-radius: 3px;
}

.tree-wrapper {
  position: relative;
}

.empty-project {
  font-size: 14px;
  display: flex;
  flex-direction: column;
  padding: 40px 12px 0;
  align-items: stretch;
  color: var(--sideBarTextColor);
}

.empty-project .empty-action-list {
  margin-top: 12px;
}
</style>
