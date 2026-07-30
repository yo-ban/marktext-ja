import { shallowRef } from 'vue'
// Type-only import: it is erased at build time, so it does not pull the icon
// database back into this chunk.
import type { FileIcons } from '@marktext/file-icons'

// The rule database plus its stylesheet is ~270KB that only matters once a
// folder is open, so it is fetched on first use. Holding it in a ref means the
// `computed` in icon.vue re-runs when it lands and swaps the placeholder for
// the real icon.
const fileIcons = shallowRef<FileIcons | null>(null)
let pending: Promise<void> | null = null

export const loadFileIcons = (): Promise<void> => {
  if (!pending) {
    pending = import('./fileIcons').then((module) => {
      fileIcons.value = module.default
    })
  }
  return pending
}

const getClassByName = (db: FileIcons, name: string): string | null => {
  const icon = db.matchName(name)
  return icon ? icon.getClass(0, false) : null
}

/**
 * Resolve the icon CSS classes for a file name shown in the side bar tree.
 *
 * file-icons tests whole-name rules before extension rules, so a markdown
 * file whose name resembles another tool's (`Dockerfile-Notes.md`) picks up
 * that tool's icon (#4890). The tree only lists files with markdown
 * extensions (see main/filesystem/watcher.ts), so the extension is the
 * reliable signal — match on it first and use the full name only as a
 * fallback for extensionless names.
 *
 * Returns no classes until the icon database has loaded; callers render an
 * empty, correctly-sized slot in the meantime.
 */
export const getFileIconClasses = (fileName: string): string[] => {
  const db = fileIcons.value
  if (!db) {
    loadFileIcons().catch((err) => {
      console.error('Failed to load the file icon database:', err)
    })
    return []
  }
  const name = fileName || 'mock.md'
  const dotIndex = name.lastIndexOf('.')
  const classNames =
    (dotIndex !== -1 ? getClassByName(db, `mock${name.slice(dotIndex)}`) : null) ??
    getClassByName(db, name) ??
    // Use fallback icon when the icon is unknown.
    getClassByName(db, 'mock.md')
  return (classNames ?? '').split(/\s/)
}
