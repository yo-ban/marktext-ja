// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// The editor's event dispatch gates every DOM event on the current selection
// resolving to a single block. compositionstart/end went through the same
// gate, so a compositionend arriving while the selection was momentarily
// unresolvable (an IME mid-flight state) was dropped — `isComposed` stuck
// true on the block, which then ignored every input/keydown forever with no
// way to recover short of reloading. compositionend is now routed back to
// the block that received the compositionstart, gate or no gate.

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

function isComposedOf(block: Format): boolean {
    return (block as unknown as { isComposed: boolean }).isComposed;
}

describe('editor event gate vs composition lifecycle', () => {
    it('delivers compositionend to the composing block even when the selection is gone', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(2, 2, true);

        content.domNode!.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true, data: '' }),
        );
        expect(isComposedOf(content)).toBe(true);

        // The mid-IME state the gate could not resolve: no DOM selection at
        // all when compositionend fires.
        document.getSelection()?.removeAllRanges();
        content.domNode!.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true, data: 'て' }),
        );

        // The old gate dropped the event here and isComposed stuck true —
        // the block never accepted input again.
        expect(isComposedOf(content)).toBe(false);
    });

    it('normal compositionstart/end round-trip still works through the gate', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(5, 5, true);

        content.domNode!.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true, data: '' }),
        );
        expect(isComposedOf(content)).toBe(true);

        content.domNode!.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true, data: '' }),
        );
        expect(isComposedOf(content)).toBe(false);
    });
});
