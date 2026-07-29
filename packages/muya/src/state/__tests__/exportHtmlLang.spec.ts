// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

// `generate({ lang })` sets the content language on the exported <html>.
// Browsers and PDF rendering resolve CJK glyph style from it (Han
// unification), so a Japanese document exported with the historical
// hard-coded lang="en" could render with Chinese-style glyphs.

const SAMPLE = '# 見出し\n\n日本語の本文。\n';

describe('markdownToHtml.generate — content language', () => {
    it('emits the given language on <html>', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({ lang: 'ja' });
        expect(out).toContain('<html lang="ja">');
    });

    it('defaults to lang="en" when no language is given', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({});
        expect(out).toContain('<html lang="en">');
    });

    it('falls back to lang="en" for a value that is not a plain language tag', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({ lang: '"><script>' });
        expect(out).toContain('<html lang="en">');
        expect(out).not.toContain('lang=""><script>');
    });

    it('composes with dir', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({ lang: 'ja', dir: 'auto' });
        expect(out).toContain('<html lang="ja" dir="auto">');
    });
});
