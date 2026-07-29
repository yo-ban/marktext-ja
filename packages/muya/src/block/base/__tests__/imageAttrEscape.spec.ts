// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// Stored-XSS regression guard (upstream PR #4980, CWE-79): image attribute
// values are concatenated into an `<img ...>` string when the image edit UI
// re-serializes a token. Unescaped, a crafted value like
// `x" onerror="alert(1)` breaks out of the attribute and injects an event
// handler that executes when the editor renders the tag.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstBlock(muya: Muya): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    return content;
}

describe('image attribute serialization escapes HTML (PR #4980)', () => {
    it('a quote-breaking alt cannot inject an event handler via replaceImage', () => {
        const markdown = '<img src="a.png" alt="x" />\n';
        const muya = bootMuya(markdown);
        const content = firstBlock(muya);

        const token = {
            type: 'html_tag',
            range: { start: 0, end: content.text.length },
            attrs: { src: 'a.png', alt: 'x' },
        };

        content.replaceImage({ token } as never, {
            alt: 'x" onerror="alert(1)',
            src: 'a.png',
            title: '',
        });

        // The payload is inert: the quote is entity-escaped inside the alt
        // value instead of terminating the attribute.
        expect(content.text).toContain('alt="x&quot; onerror=&quot;alert(1)"');
        expect(content.text).not.toContain('onerror="alert(1)"');
    });

    it('legitimate plain attribute values round-trip unchanged', () => {
        const markdown = '<img src="a.png" alt="cat" />\n';
        const muya = bootMuya(markdown);
        const content = firstBlock(muya);

        const token = {
            type: 'html_tag',
            range: { start: 0, end: content.text.length },
            attrs: { src: 'a.png', alt: 'cat' },
        };

        content.replaceImage({ token } as never, { alt: 'dog', src: 'a.png', title: '' });

        expect(content.text).toContain('alt="dog"');
        expect(content.text).toContain('src="a.png"');
    });
});
