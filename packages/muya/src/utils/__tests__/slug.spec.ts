import { describe, expect, it } from 'vitest';
import { generateGithubSlug } from '../slug';

// The slug is both the TOC link target and the heading `id` in exported HTML
// (single implementation, used by getTOC and MarkdownToHtml). The ASCII-only
// version reduced an all-CJK heading to an empty slug, so every TOC entry for
// a Japanese document pointed at `#` — matching GitHub's Unicode slugger fixes
// the round trip.
describe('generateGithubSlug', () => {
    it('keeps ASCII behaviour: lowercase, spaces to hyphens, punctuation stripped', () => {
        expect(generateGithubSlug('Hello World!')).toBe('hello-world');
        expect(generateGithubSlug('  A  B  ')).toBe('a-b');
        expect(generateGithubSlug('a_b-c')).toBe('a_b-c');
    });

    it('keeps Japanese heading text as the anchor', () => {
        expect(generateGithubSlug('見出し')).toBe('見出し');
        expect(generateGithubSlug('はじめに')).toBe('はじめに');
        expect(generateGithubSlug('第1章 概要')).toBe('第1章-概要');
    });

    it('strips CJK punctuation like ASCII punctuation', () => {
        expect(generateGithubSlug('概要。まとめ')).toBe('概要まとめ');
        expect(generateGithubSlug('「引用」について')).toBe('引用について');
    });

    it('mixed Latin + Japanese headings survive', () => {
        expect(generateGithubSlug('API リファレンス')).toBe('api-リファレンス');
    });
});
