import { describe, expect, it } from 'vitest'
import { createDocumentState, getBlankFileState } from '@/store/help'

// The title-bar word counter reads `tab.wordCount`, which was only ever
// written by the engine's content-change event — so a freshly opened document
// displayed "W 0" until the first edit (or a source-code-mode round trip,
// which pushes full state). Tab states must now carry the count from the
// moment they are created.

describe('word count is present as soon as a tab state exists', () => {
  it('an opened document arrives with its count computed', () => {
    const state = createDocumentState({
      markdown: '# 見出し\n\n日本語のテスト。\n\nHello counted words.\n',
      filename: 'a.md',
      pathname: '/docs/a.md'
    })

    // 3 kanji + 4 kana+kanji… exact numbers are wordCount()'s contract; here
    // we pin only that the count is real, not zero.
    expect(state.wordCount.word).toBeGreaterThan(0)
    expect(state.wordCount.character).toBeGreaterThan(0)
    expect(state.wordCount.paragraph).toBe(3)
  })

  it('a restored buffer that carries its own count keeps it', () => {
    const carried = { word: 42, character: 100, paragraph: 7, all: 120 }
    const state = createDocumentState({ markdown: 'x', wordCount: carried })

    expect(state.wordCount).toEqual(carried)
  })

  it('a blank untitled tab starts at zero; a seeded one starts counted', () => {
    const blank = getBlankFileState([])
    expect(blank.wordCount.word).toBe(0)

    const seeded = getBlankFileState([], 'utf8', 'lf', 'seeded words here\n')
    expect(seeded.wordCount.word).toBe(3)
  })
})
