import { describe, expect, it } from 'vitest';
import { wordCount } from '../index';

// Characterization of the current wordCount algorithm in src/utils/index.ts.
// It returns { word, paragraph, character, all }:
//  - paragraph: count of non-empty chunks split on two-or-more newlines.
//  - word: number of CJK chars (Han / Hiragana / Katakana / Hangul scripts)
//    + number of whitespace tokens in the CJK-stripped string.
//  - character: total length of those non-CJK tokens + number of CJK chars
//    (i.e. excludes whitespace between tokens).
//  - all: the raw markdown string length.
describe('wordCount', () => {
    it('counts plain ASCII words', () => {
        expect(wordCount('hello world')).toEqual({
            word: 2,
            character: 10,
            paragraph: 1,
            all: 11,
        });
    });

    it('counts each CJK character as its own word', () => {
        const result = wordCount('你好 world');
        expect(result.word).toBe(3);
        expect(result.character).toBe(7);
        expect(result.paragraph).toBe(1);
        expect(result.all).toBe(8);
    });

    // The old range covered only common Han ideographs, so an all-hiragana
    // paragraph counted as one giant "word".
    it('counts hiragana and katakana characters as words', () => {
        // 3 kanji + 1 hiragana (の) + 3 katakana = 7
        const result = wordCount('日本語のテスト');
        expect(result.word).toBe(7);
        expect(result.character).toBe(7);
    });

    it('counts a mixed Japanese/Latin sentence sensibly', () => {
        // 'これはAPIです' = これは(3) + です(2) = 5 kana + token 'API' = 6
        const result = wordCount('これはAPIです');
        expect(result.word).toBe(6);
        expect(result.character).toBe(8);
    });

    it('splits paragraphs on blank lines', () => {
        const result = wordCount('a\n\nb\n\nc');
        expect(result.paragraph).toBe(3);
        expect(result.word).toBe(3);
        expect(result.character).toBe(3);
        expect(result.all).toBe(7);
    });

    it('returns all zeros for the empty string', () => {
        expect(wordCount('')).toEqual({
            word: 0,
            character: 0,
            paragraph: 0,
            all: 0,
        });
    });
});
