import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import { addFile, unlinkFile, addDirectory, unlinkDirectory, resortTree, updateFileMtime } from './treeCtrl'
import { usePreferencesStore } from './preferences'
import bus from '../bus'
import { create, paste, rename, type FileCreateType, type PasteOptions } from '../util/fileSystem'
import { PATH_SEPARATOR } from '../config'
import notice from '../services/notification'
import { t } from '../i18n'
import { getFileStateFromData } from './help'
import { useLayoutStore } from './layout'
import { useEditorStore } from './editor'
import { debouncedSendBufferedState } from './bufferedState'
import type { TreeNode } from '../components/sideBar/types'
import type { FileChangeDetail } from '@shared/types/files'

type ProjectTree = TreeNode
type TreeChange = FileChangeDetail

const normalizeProjectRoot = (pathname: string | null | undefined): string => {
  return pathname ? window.path.normalize(pathname) : ''
}

const isSamePath = (a: string, b: string): boolean => window.fileUtils.isSamePathSync(a, b)

const treeContainsPath = (tree: ProjectTree, pathname: string): boolean => {
  return isSamePath(tree.pathname, pathname) || window.fileUtils.isChildOfDirectory(tree.pathname, pathname)
}

const createProjectRoot = (pathname: string): ProjectTree | null => {
  const normalizedPathname = normalizeProjectRoot(pathname)
  if (!normalizedPathname) return null

  let name = window.path.basename(normalizedPathname)
  if (!name) {
    // Root directory such as "/" or "C:\"
    name = normalizedPathname
  }

  return {
    pathname: normalizedPathname,
    name,
    isDirectory: true,
    isFile: false,
    isMarkdown: false,
    folders: [],
    files: []
  }
}

interface BufferedProjectState {
  rootDirectory: string
  rootDirectories: string[]
}

const createBufferedProjectState = (state: unknown): BufferedProjectState => {
  const s = (state || {}) as {
    rootDirectory?: string
    rootDirectories?: string[]
    projectTree?: { pathname?: string }
    projectTrees?: { pathname?: string }[]
  }
  const fromList = Array.isArray(s.rootDirectories)
    ? s.rootDirectories
    : Array.isArray(s.projectTrees)
      ? s.projectTrees.map((tree) => tree.pathname).filter((p): p is string => !!p)
      : []
  const fallback = s.rootDirectory || s.projectTree?.pathname
  const rootDirectories = (fromList.length ? fromList : fallback ? [fallback] : [])
    .map((p) => normalizeProjectRoot(p))
    .filter(Boolean)
  return {
    rootDirectory: rootDirectories[0] ?? '',
    rootDirectories
  }
}

interface OpenProjectOptions {
  scheduleBufferUpdate?: boolean
}

interface CreateCacheEntry {
  dirname: string
  type: 'file' | 'directory' | string
}

interface ClipboardEntry {
  type: 'copy' | 'cut' | string
  src: string
  dest?: string
}

interface PendingEvent {
  type: string
  change: TreeChange
}

export const useProjectStore = defineStore('project', () => {
  // Heterogeneous UI state: assigned file nodes, folder nodes, and the empty
  // "no selection" object/null across sidebar components; a single non-`any`
  // union breaks both the assignments and the field reads, so it stays a hatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeItem = ref<any>({})
  const createCache = ref<CreateCacheEntry | Record<string, never>>({})
  const newFileNameCache = ref<string>('')
  const renameCache = ref<string | null>(null)
  const clipboard = ref<ClipboardEntry | null>(null)
  const projectTrees = ref<ProjectTree[]>([])
  const pendingTreeEvents = ref<PendingEvent[]>([])

  // First root, kept for call sites that still speak of a single project
  // (title bar, save-dialog default path, relative image paths).
  const projectTree = computed<ProjectTree | null>(() => projectTrees.value[0] ?? null)

  const preferencesStore = usePreferencesStore()

  watch(
    [() => preferencesStore.fileSortBy, () => preferencesStore.fileSortOrder],
    ([sortBy, sortOrder]) => {
      for (const tree of projectTrees.value) {
        resortTree(tree, String(sortBy), String(sortOrder))
      }
    }
  )

  // Prefer the deepest matching root when one opened folder contains another.
  const findTreeForPath = (pathname: string | null | undefined): ProjectTree | null => {
    if (!pathname) return null
    let best: ProjectTree | null = null
    for (const tree of projectTrees.value) {
      if (!treeContainsPath(tree, pathname)) continue
      if (!best || tree.pathname.length > best.pathname.length) {
        best = tree
      }
    }
    return best
  }

  const _removeProject = (pathname: string): boolean => {
    const normalized = normalizeProjectRoot(pathname)
    const index = projectTrees.value.findIndex((tree) => isSamePath(tree.pathname, normalized))
    if (index === -1) return false
    projectTrees.value.splice(index, 1)
    _purgePendingEventsForRoot(normalized)
    return true
  }

  // Drop queued watcher events that belonged to this root so a later reopen
  // does not replay them (in particular unlinkDir → CLOSE_PROJECT).
  const _purgePendingEventsForRoot = (pathname: string): void => {
    pendingTreeEvents.value = pendingTreeEvents.value.filter((event) => {
      const eventPath = event.change?.pathname
      if (!eventPath) return false
      return !(isSamePath(eventPath, pathname) || window.fileUtils.isChildOfDirectory(pathname, eventPath))
    })
  }

  const _drainPendingEvents = (): void => {
    if (!pendingTreeEvents.value.length) return
    const remaining: PendingEvent[] = []
    for (const event of pendingTreeEvents.value) {
      if (findTreeForPath(event.change.pathname)) {
        _processTreeEvent(event.type, event.change)
      } else {
        remaining.push(event)
      }
    }
    pendingTreeEvents.value = remaining
  }

  function OPEN_PROJECT(
    pathname: string,
    { scheduleBufferUpdate = true }: OpenProjectOptions = {}
  ): void {
    const layoutStore = useLayoutStore()
    const tree = createProjectRoot(pathname)
    if (!tree) return

    if (projectTrees.value.some((existing) => isSamePath(existing.pathname, tree.pathname))) {
      return
    }

    if (projectTrees.value.some((existing) => window.fileUtils.isChildOfDirectory(existing.pathname, tree.pathname))) {
      return
    }

    projectTrees.value = projectTrees.value.filter(
      (existing) => !window.fileUtils.isChildOfDirectory(tree.pathname, existing.pathname)
    )
    projectTrees.value.push(tree)

    const layout = {
      rightColumn: 'files',
      showSideBar: true,
      showTabBar: true
    }
    layoutStore.SET_LAYOUT(layout, { scheduleBufferUpdate })
    layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()

    _drainPendingEvents()

    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function CLOSE_PROJECT(pathname: string): void {
    if (!_removeProject(pathname)) return
    window.electron.ipcRenderer.send('mt::close-directory', pathname)
    debouncedSendBufferedState()
  }

  function CREATE_BUFFERED_STATE(): BufferedProjectState {
    return createBufferedProjectState({
      projectTrees: projectTrees.value
    })
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const { rootDirectories } = createBufferedProjectState(state)
    const current = projectTrees.value.map((tree) => tree.pathname)
    const same =
      current.length === rootDirectories.length &&
      current.every((p, i) => isSamePath(p, rootDirectories[i]))
    if (same) return

    projectTrees.value = []
    pendingTreeEvents.value = []
    for (const dir of rootDirectories) {
      OPEN_PROJECT(dir, { scheduleBufferUpdate: false })
    }
  }

  function LISTEN_FOR_LOAD_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::open-directory', (_e, pathname) => {
      OPEN_PROJECT(String(pathname))
    })
    window.electron.ipcRenderer.on('mt::directory-closed', (_e, pathname) => {
      if (_removeProject(String(pathname))) {
        debouncedSendBufferedState()
      }
    })
  }

  function LISTEN_FOR_UPDATE_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const { type, change } = (payload as { type: string; change: TreeChange }) ?? {}
      if (!findTreeForPath(change?.pathname)) {
        // Unlinks for a tree we don't have are the close we just did (or a
        // race against an already-gone root). Queueing them would replay
        // CLOSE_PROJECT the next time that folder is opened.
        if (type === 'unlink' || type === 'unlinkDir') return
        pendingTreeEvents.value.push({ type, change })
        return
      }
      _processTreeEvent(type, change)
    })
  }

  function _processTreeEvent(type: string, change: TreeChange): void {
    const tree = findTreeForPath(change.pathname)
    if (!tree) return

    const editorStore = useEditorStore()
    switch (type) {
      case 'add': {
        const { pathname, data, isMarkdown } = change
        addFile(tree, change as Parameters<typeof addFile>[1], String(preferencesStore.fileSortBy), String(preferencesStore.fileSortOrder))
        if (isMarkdown && newFileNameCache.value && isSamePath(pathname, newFileNameCache.value)) {
          const fileState = getFileStateFromData(data as Record<string, unknown>)
          editorStore.UPDATE_CURRENT_FILE(fileState)
          newFileNameCache.value = ''
        }
        break
      }
      case 'unlink':
        unlinkFile(tree, change)
        editorStore.SET_SAVE_STATUS_WHEN_REMOVE(change)
        break
      case 'addDir':
        addDirectory(tree, change)
        break
      case 'unlinkDir':
        if (isSamePath(tree.pathname, change.pathname)) {
          CLOSE_PROJECT(change.pathname)
        } else {
          unlinkDirectory(tree, change)
        }
        break
      case 'change':
        if (change?.mtimeMs !== undefined) {
          updateFileMtime(tree, change as Parameters<typeof updateFileMtime>[1], String(preferencesStore.fileSortBy), String(preferencesStore.fileSortOrder))
        }
        break
      default:
        if (window.electron?.process?.env?.NODE_ENV === 'development') {
          console.log(`Unknown directory watch type: "${type}"`)
        }
        break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CHANGE_ACTIVE_ITEM(item: any): void {
    activeItem.value = item
  }

  function CHANGE_CLIPBOARD(data: ClipboardEntry | null): void {
    clipboard.value = data
  }

  function ASK_FOR_OPEN_PROJECT(): void {
    window.electron.ipcRenderer.send('mt::ask-for-open-project-in-sidebar')
  }

  function LISTEN_FOR_SIDEBAR_CONTEXT_MENU(): void {
    bus.on('SIDEBAR::show-in-folder', () => {
      const { pathname } = activeItem.value
      window.electron.shell.showItemInFolder(pathname)
    })
    bus.on('SIDEBAR::new', (type: unknown) => {
      const { pathname, isDirectory } = activeItem.value
      const dirname = isDirectory ? pathname : window.path.dirname(pathname)
      createCache.value = { dirname, type: String(type) }
      bus.emit('SIDEBAR::show-new-input')
    })
    bus.on('SIDEBAR::remove', () => {
      const { pathname } = activeItem.value
      window.electron.ipcRenderer.invoke('mt::fs-trash-item', pathname).catch((err) => {
        notice.notify({
          title: t('store.project.deleteErrorTitle'),
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      })
    })
    bus.on('SIDEBAR::copy-cut', (type: unknown) => {
      const { pathname: src } = activeItem.value
      clipboard.value = { type: String(type), src }
    })
    bus.on('SIDEBAR::paste', () => {
      const cb = clipboard.value
      const { pathname, isDirectory } = activeItem.value
      const dirname = isDirectory ? pathname : window.path.dirname(pathname)
      if (cb && cb.src) {
        cb.dest = dirname + PATH_SEPARATOR + window.path.basename(cb.src)

        if (window.path.normalize(cb.src) === window.path.normalize(cb.dest)) {
          notice.notify({
            title: t('store.project.pasteForbiddenTitle'),
            type: 'warning',
            message: t('store.project.pasteForbiddenMessage')
          })
          return
        }

        paste(cb as PasteOptions)
          .then(() => {
            clipboard.value = null
          })
          .catch((err) => {
            notice.notify({
              title: t('store.project.pasteErrorTitle'),
              type: 'error',
              message: err instanceof Error ? err.message : String(err)
            })
          })
      }
    })
    bus.on('SIDEBAR::rename', () => {
      const { pathname } = activeItem.value
      renameCache.value = pathname
      bus.emit('SIDEBAR::show-rename-input')
    })
    bus.on('SIDEBAR::close-folder', () => {
      const { pathname } = activeItem.value
      if (pathname) {
        CLOSE_PROJECT(pathname)
      }
    })
  }

  async function CREATE_FILE_DIRECTORY(name: string): Promise<void> {
    const cache = createCache.value as CreateCacheEntry
    const { dirname, type } = cache

    if (type === 'file' && !window.fileUtils.hasMarkdownExtension(name)) {
      name += '.md'
    }

    const fullName = `${dirname}/${name}`

    // Creating over an existing path would silently overwrite it (outputFile
    // truncates). Refuse instead of destroying the existing file (#1946).
    if (await window.fileUtils.pathExists(fullName)) {
      createCache.value = {}
      notice.notify({
        title: t('store.project.sideBarErrorTitle'),
        type: 'error',
        message: t('store.project.alreadyExists', { type, name })
      })
      return
    }

    create(fullName, type as FileCreateType)
      .then(() => {
        createCache.value = {}
        if (type === 'file') {
          newFileNameCache.value = fullName
        }
      })
      .catch((err) => {
        notice.notify({
          title: t('store.project.sideBarErrorTitle'),
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      })
  }

  function RENAME_IN_SIDEBAR(name: string): void {
    const editorStore = useEditorStore()
    const src = renameCache.value
    if (!src) return
    const dirname = window.path.dirname(src)
    const dest = dirname + PATH_SEPARATOR + name
    rename(src, dest)
      .then(() => {
        editorStore.RENAME_IF_NEEDED({ src, dest })
      })
      .catch((err) => {
        notice.notify({
          title: t('store.project.renameErrorTitle'),
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      })
  }

  function OPEN_SETTING_WINDOW(): void {
    window.electron.ipcRenderer.send('mt::open-setting-window')
  }

  return {
    activeItem,
    createCache,
    newFileNameCache,
    renameCache,
    clipboard,
    projectTree,
    projectTrees,
    pendingTreeEvents,
    findTreeForPath,
    OPEN_PROJECT,
    CLOSE_PROJECT,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    LISTEN_FOR_LOAD_PROJECT,
    LISTEN_FOR_UPDATE_PROJECT,
    CHANGE_ACTIVE_ITEM,
    CHANGE_CLIPBOARD,
    ASK_FOR_OPEN_PROJECT,
    LISTEN_FOR_SIDEBAR_CONTEXT_MENU,
    CREATE_FILE_DIRECTORY,
    RENAME_IN_SIDEBAR,
    OPEN_SETTING_WINDOW
  }
})
