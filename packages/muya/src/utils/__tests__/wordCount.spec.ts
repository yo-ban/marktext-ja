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

// `wordCount` was rewritten from three whole-string transforms into a single
// pass (it runs on the entire document on every keystroke). The counts it
// reports are user-visible, so they must not shift by even one: this pins the
// new implementation against the old one over inputs that exercise every branch
// it has — separator runs, CJK-only tokens, exotic whitespace, astral pairs.
describe('wordCount — identical to the string-splitting implementation', () => {
    const CJK_CHAR_REG
        = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

    function reference(markdown: string) {
        const paragraph = markdown.split(/\n{2,}/).filter(line => line).length;
        const removedCJK = markdown.replace(CJK_CHAR_REG, '');
        const tokens = removedCJK.split(/\s+/).filter(t => t);
        const cjkLength = markdown.length - removedCJK.length;

        return {
            word: cjkLength + tokens.length,
            paragraph,
            character: tokens.reduce((acc, t) => acc + t.length, 0) + cjkLength,
            all: markdown.length,
        };
    }

    const cases = [
        '',
        ' ',
        '\n',
        '\n\n',
        '\n\n\n\n',
        '\n\na',
        'a\n\n',
        'a\n\n \n\nb',
        'a\nb',
        'a\r\n\r\nb',
        'hello world',
        '   leading and trailing   ',
        '日本語のテスト',
        'これはAPIです',
        '漢 字',
        'a漢b',
        'a漢 b',
        '漢字だけ\n\n漢字だけ',
        '한국어 테스트',
        'tabs\tand nbsp　ideographic',
        'zero​width﻿marks',
        '𠮷野家',
        'emoji 🎉 and 𝔘𝔫𝔦𝔠𝔬𝔡𝔢',
        '# Heading\n\n- item one\n- item two\n\n| a | b |\n| - | - |\n',
    ];

    it.each(cases)('matches for %j', (input) => {
        expect(wordCount(input)).toEqual(reference(input));
    });

    it('matches for randomly assembled documents', () => {
        const alphabet = [
            'a',
            'z',
            'Q',
            '9',
            '.',
            '-',
            '#',
            '*',
            '`',
            ' ',
            '\t',
            '\n',
            ' ',
            '　',
            ' ',
            '漢',
            'あ',
            'ア',
            '한',
            '𠮷',
            '🎉',
        ];
        // Deterministic PRNG: a failure has to be reproducible from the seed.
        let seed = 0x2F6E2B1;
        const next = () => {
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
            return seed;
        };

        for (let doc = 0; doc < 500; doc++) {
            const length = next() % 120;
            let input = '';

            for (let i = 0; i < length; i++)
                input += alphabet[next() % alphabet.length];

            expect({ input, ...wordCount(input) }).toEqual({
                input,
                ...reference(input),
            });
        }
    });
});
