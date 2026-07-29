// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// The empty-table-cell ZWSP workaround exists for a Safari quirk, but it ran
// on every engine: compositionstart rewrote `textContent`, replacing the text
// node the IME had just anchored to (breaking the composition on Chromium),
// and the compensating strip on compositionend ate the last committed
// character. It is now gated to Safari — these tests run under a
// Chromium-like UA and pin the non-Safari behavior.

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

function firstEmptyCell(muya: Muya): Content {
    let target: Content | null = null;
    const visit = (block: {
        text?: string;
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (!target && block.constructor.blockName === 'table.cell.content' && block.text === '')
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('empty table cell not found');
    return target;
}

const TABLE = '| a | b |\n| --- | --- |\n|  | x |\n';

describe('tableCell empty-cell ZWSP workaround is Safari-only', () => {
    it('compositionstart does not rewrite the cell DOM on non-Safari engines', () => {
        const muya = bootMuya(TABLE);
        const cell = firstEmptyCell(muya);
        muya.editor.activeContentBlock = cell;
        const nodeBefore = cell.domNode!.firstChild;

        cell.composeHandler(new CompositionEvent('compositionstart', { data: '' }));

        expect(cell.domNode!.textContent).not.toContain('​');
        expect(cell.domNode!.firstChild).toBe(nodeBefore);
    });

    it('compositionend does not strip the last committed character', () => {
        const muya = bootMuya(TABLE);
        const cell = firstEmptyCell(muya);
        muya.editor.activeContentBlock = cell;

        cell.composeHandler(new CompositionEvent('compositionstart', { data: '' }));
        // The IME committed 'て' into the cell.
        cell.domNode!.textContent = 'て';
        const range = document.createRange();
        range.setStart(cell.domNode!.firstChild!, 1);
        range.collapse(true);
        const sel = document.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        cell.composeHandler(new CompositionEvent('compositionend', { data: 'て' }));

        expect(cell.text).toBe('て');
    });
});
