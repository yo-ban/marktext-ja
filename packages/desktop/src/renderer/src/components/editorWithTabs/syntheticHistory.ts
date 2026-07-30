// Synthetic save-tracking history for the WYSIWYG engine.
//
// The `@muyajs/core` engine's undo/redo history (`getHistory()`) has a
// different shape than the desktop store's `tab.history` (which drives the
// save/dirty indicator). The renderer therefore feeds the store a SYNTHETIC,
// desktop-shaped history whose single stack entry carries an `id` the store
// compares against `tab.lastSavedHistoryId`: when the current id equals the
// saved id the tab is shown as clean, otherwise dirty.
//
// The id MUST satisfy two properties:
//   1. clean  <=> the live document content matches the saved-on-disk content.
//   2. monotonic & never-reused: a divergent edit can never collide with the
//      saved id, even when it returns the engine undo-stack to the same DEPTH.
//
// An earlier implementation used the undo-stack DEPTH as the id. Depth is
// REUSED across distinct documents at the same stack height, so the sequence
//   type A, type B, save, undo B, type C  (a NEW divergent edit)
// returned the depth — and therefore the id — to the saved value while the
// document was actually A+C, falsely showing the tab as clean and risking
// data loss on close-without-save (Phase G — G6).
//
// Legacy muyajs avoided this by assigning every pushed history entry a
// MONOTONIC, never-reused id and splicing the redo tail on a new edit. We
// reproduce the exact semantics here, but keyed on the live document content
// rather than on the engine's internal stack objects (the engine regenerates
// its undo operations via invert on every undo/redo, so object identity is not
// stable). Each DISTINCT content snapshot is assigned a fresh monotonic id the
// first time it is seen; revisiting an earlier snapshot (undo/redo back to it)
// reuses that snapshot's original id. Undoing back to the saved content
// therefore restores the saved id (clean); a divergent re-edit produces brand
// new content and hence a brand new id (dirty) — never the saved one.

// Trailing newlines are NOT meaningful content for save/dirty tracking — the
// store itself normalizes them via `adjustTrailingNewlines`/`trimTrailingNewline`
// before saving. The engine's markdown serialization is also unstable across a
// `setContent` -> edit -> undo round-trip purely in trailing newlines (loading
// `'x\n'` may serialize to `'x\n\n\n'`, while undoing an edit lands on `'x\n'`),
// so the content signature must ignore them or undo-to-saved would never match.
// Returned as an end index rather than a trimmed copy: this runs on the whole
// document on every keystroke, and the copy alone was megabytes of churn.
const contentEndIndex = (content: string): number => {
  let end = content.length
  while (end > 0) {
    const code = content.charCodeAt(end - 1)
    if (code !== 0x0a && code !== 0x0d) break
    end--
  }
  return end
}

// A stable 64-bit content hash. Used so the content -> id map stores short keys
// instead of whole documents; a collision would map two genuinely different
// documents to the same id and could reintroduce the false-clean it guards
// against. 64 bits keeps the collision probability negligible even for a long
// editing session with many thousands of distinct snapshots (a 32-bit hash hits
// ~50% collision odds near ~77k snapshots via the birthday bound).
//
// Two 32-bit lanes with `Math.imul` and a final avalanche (cyrb64), NOT the
// arithmetically simpler BigInt FNV-1a this replaced: the hash covers the entire
// document on every keystroke, and one BigInt multiply per character made it
// ~6% of the renderer's CPU time while typing in a 100KB file.
const hashContent = (content: string): string => {
  const end = contentEndIndex(content)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < end; i++) {
    const code = content.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(36)}:${(h1 >>> 0).toString(36)}`
}

export interface IFileHistoryLike {
  stack: Array<{ id: number | string; [key: string]: unknown }>
  index: number
  lastEditIndex: number
  lastInitIndex: number
}

// Per-tab monotonic id allocator. Created once when a tab's content baseline is
// established and reset whenever the engine reloads the document (`setContent`
// clears the engine history), so the baseline id is always 0 — matching the
// store's seeded `lastSavedHistoryId: 0` for a freshly loaded/clean document.
export class SyntheticHistory {
  private counter = 0
  private readonly idByContent = new Map<string, number>()

  constructor(baselineContent: string = '') {
    // The freshly-loaded document is its own clean baseline; the store seeds
    // `lastSavedHistoryId` to 0, so the baseline content must map to id 0.
    this.idByContent.set(hashContent(baselineContent), 0)
  }

  // Return the monotonic id for the given content snapshot, assigning a fresh,
  // never-reused id the first time a snapshot is seen and reusing the original
  // id on every subsequent revisit (undo/redo back to it).
  idFor(content: string): number {
    const key = hashContent(content)
    let id = this.idByContent.get(key)
    if (id === undefined) {
      id = ++this.counter
      this.idByContent.set(key, id)
    }
    return id
  }

  // Build the desktop-shaped synthetic history the store consumes. The store
  // only reads `stack[lastEditIndex].id`; the remaining fields keep its
  // bookkeeping happy (a single committed edit at index 0).
  build(content: string): IFileHistoryLike {
    return {
      stack: [{ id: this.idFor(content) }],
      index: 0,
      lastEditIndex: 0,
      lastInitIndex: -1
    }
  }
}
