<template>
  <div class="tree-view">
    <div class="title">
      <!-- Placeholder -->
    </div>

    <!-- Opened tabs -->
    <div v-if="openedFilesInSidebar" class="opened-files">
      <div class="title">
        <el-icon
          class="icon-arrow"
          :class="{ fold: !showOpenedFiles }"
          :size="12"
          @click.stop="toggleOpenedFiles()"
        >
          <ArrowRight />
        </el-icon>
        <span
          class="default-cursor text-overflow"
          @click.stop="toggleOpenedFiles()"
        >{{
          t('sideBar.tree.openedFiles')
        }}</span>
        <a
          href="javascript:;"
          :title="t('sideBar.tree.saveAll')"
          @click.stop="saveAll(false)"
        >
          <svg
            class="icon"
            aria-hidden="true"
          >
            <use xlink:href="#icon-save-all" />
          </svg>
        </a>
        <a
          href="javascript:;"
          :title="t('sideBar.tree.closeAll')"
          @click.stop="saveAll(true)"
        >
          <svg
            class="icon"
            aria-hidden="true"
          >
            <use xlink:href="#icon-close-all" />
          </svg>
        </a>
      </div>
      <div
        v-show="showOpenedFiles"
        class="opened-files-list"
      >
        <transition-group name="list">
          <opened-file
            v-for="tab of tabs"
            :key="tab.id"
            :file="tab"
          />
        </transition-group>
      </div>
    </div>

    <!-- Folders: heading stays visible so the open-folder control is always
         reachable. Opened roots stack below it. -->
    <div class="folders-section">
      <div class="title">
        <el-icon
          class="icon-arrow"
          :class="{ fold: !showDirectories }"
          :size="12"
          @click.stop="toggleDirectories()"
        >
          <ArrowRight />
        </el-icon>
        <span
          class="default-cursor text-overflow"
          @click.stop="toggleDirectories()"
        >{{
          t('sideBar.tree.folders')
        }}</span>
        <a
          href="javascript:;"
          class="open-folder"
          :title="t('sideBar.tree.openFolder')"
          @click.stop="openFolder()"
        >
          <el-icon :size="14">
            <FolderOpened />
          </el-icon>
        </a>
      </div>
      <div
        v-show="showDirectories"
        class="folders-list"
      >
        <tree-project
          v-for="tree of projectTrees"
          :key="tree.pathname"
          :tree="tree"
          @close="closeFolder(tree.pathname)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import OpenedFile from './treeOpenedTab.vue'
import TreeProject from './treeProject.vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, FolderOpened } from '@element-plus/icons-vue'
import type { TabDescriptor } from './types'

const { t } = useI18n()

defineProps<{
  openedFiles?: TabDescriptor[]
  tabs?: TabDescriptor[]
}>()

// Persist the section collapse state (#2421). The tree is rendered under a
// v-if and is destroyed when the sidebar collapses to its icon strip, so local
// refs reset to expanded on re-open. Back them with localStorage (like the
// sidebar width) so the state survives a re-mount and app restart.
const SHOW_DIRECTORIES_KEY = 'side-bar-show-directories'
const SHOW_OPENED_FILES_KEY = 'side-bar-show-opened-files'
const readSectionExpanded = (key: string): boolean => localStorage.getItem(key) !== 'false'
const showDirectories = ref(readSectionExpanded(SHOW_DIRECTORIES_KEY))
const showOpenedFiles = ref(readSectionExpanded(SHOW_OPENED_FILES_KEY))

const projectStore = useProjectStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const { projectTrees } = storeToRefs(projectStore)
const { openedFilesInSidebar } = storeToRefs(preferencesStore)

const saveAll = (isClose: boolean): void => {
  editorStore.ASK_FOR_SAVE_ALL(isClose)
}

const openFolder = (): void => {
  projectStore.ASK_FOR_OPEN_PROJECT()
}

const closeFolder = (pathname: string): void => {
  projectStore.CLOSE_PROJECT(pathname)
}

const toggleOpenedFiles = (): void => {
  showOpenedFiles.value = !showOpenedFiles.value
  localStorage.setItem(SHOW_OPENED_FILES_KEY, String(showOpenedFiles.value))
}

const toggleDirectories = (): void => {
  showDirectories.value = !showDirectories.value
  localStorage.setItem(SHOW_DIRECTORIES_KEY, String(showDirectories.value))
}

// Hide rename / create inputs on outside clicks. Buttons that open these
// inputs must use @click.stop so their click never reaches this listener.
const handleDocumentClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null
  if (target && target.tagName !== 'INPUT') {
    projectStore.CHANGE_ACTIVE_ITEM({})
    projectStore.createCache = {}
    projectStore.renameCache = null
  }
}

const handleDocumentContextMenu = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null
  if (target && target.tagName !== 'INPUT') {
    projectStore.createCache = {}
    projectStore.renameCache = null
  }
}

const handleDocumentKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    projectStore.createCache = {}
    projectStore.renameCache = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('contextmenu', handleDocumentContextMenu)
  document.addEventListener('keydown', handleDocumentKeydown)
})

// The sidebar destroys and recreates this component on every panel switch, so
// without teardown each visit leaves another set of document listeners writing
// into the project store on every click in the app.
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('contextmenu', handleDocumentContextMenu)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<style scoped>
.list-item {
  display: inline-block;
  margin-right: 10px;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.2s;
}
.list-enter, .list-leave-to
  /* .list-leave-active for below version 2.1.8 */ {
  opacity: 0;
  transform: translateX(-50px);
}
.tree-view {
  font-size: 14px;
  color: var(--sideBarColor);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tree-view > .title {
  height: 35px;
  line-height: 35px;
  padding: 0 15px;
  display: flex;
  flex-shrink: 0;
  flex-direction: row-reverse;
}

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

.opened-files > .title,
.folders-section > .title {
  height: 30px;
  line-height: 30px;
  font-size: 14px;
}

.opened-files .title,
.folders-section > .title {
  padding-right: 15px;
  display: flex;
  align-items: center;
}

.opened-files .title > span,
.folders-section > .title > span {
  flex: 1;
  user-select: none;
}

.opened-files .title > a {
  display: none;
  text-decoration: none;
  color: var(--sideBarColor);
  margin-left: 8px;
}
.opened-files div.title:hover > a,
.opened-files div.title > a:hover {
  display: block;
}

.opened-files div.title:hover > a:hover,
.opened-files div.title > a:hover:hover {
  color: var(--highlightThemeColor);
}
.opened-files {
  display: flex;
  flex-direction: column;
}
.default-cursor {
  cursor: pointer;
}
.opened-files .opened-files-list {
  max-height: 112px;
  overflow: auto;
  flex: 1;
}

.opened-files .opened-files-list::-webkit-scrollbar:vertical {
  width: 8px;
}

.folders-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.folders-section > .title > a.open-folder {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: var(--sideBarColor);
  margin-left: 8px;
  line-height: 0;
}

.folders-section > .title > a.open-folder:hover {
  color: var(--highlightThemeColor);
}

.folders-list {
  overflow: auto;
  flex: 1;
}

.folders-list::-webkit-scrollbar:vertical {
  width: 8px;
}
</style>
