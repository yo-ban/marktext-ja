// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Upstream #5028 (reported on the legacy 0.19.1 engine): undoing past the
// document's opening state emptied the whole file. Pin the floor contract on
// the current engine: the loaded document is the undo baseline — any number
// of extra undos must leave it intact.

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

describe('undo floor — the opened document is the baseline (#5028)', () => {
    it('undo on a freshly opened document is a no-op', () => {
        const muya = bootMuya('# Title\n\nbody text\n');

        muya.undo();
        muya.undo();

        expect(muya.getMarkdown()).toContain('# Title');
        expect(muya.getMarkdown()).toContain('body text');
    });

    it('undoing past the only edit restores the baseline and stays there', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);

        content.text = 'hello world';
        muya.editor.jsonState.flush();

        // One undo returns to the baseline…
        muya.undo();
        expect(content.text).toBe('hello');

        // …and hammering undo (the reporter's "pressed a few too many
        // times") must not empty the document.
        muya.undo();
        muya.undo();
        muya.undo();
        expect(muya.getMarkdown().trim()).not.toBe('');
        expect(muya.getMarkdown()).toContain('hello');
    });
});
