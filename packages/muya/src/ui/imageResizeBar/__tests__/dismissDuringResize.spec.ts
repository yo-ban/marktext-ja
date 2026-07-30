// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { ImageResizeBar } from '../index';

// Regression for the #4995 crash class: the resize bar's render is queued
// behind a setTimeout and its drag listeners live on document.body, so a
// dismissal (image deleted from the toolbar, edit dialog opened, document
// replaced) could land in between and leave the handlers running against a
// null reference / removed bars.

const bootedMuyas: Muya[] = [];
const bootedBars: ImageResizeBar[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    while (bootedBars.length)
        bootedBars.pop()!.destroy();
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

function makeReference(): HTMLElement {
    const container = document.createElement('span');
    container.appendChild(document.createElement('img'));
    document.body.appendChild(container);
    return container;
}

function stubBlock() {
    return { updateImage: vi.fn() } as unknown as Format;
}

const imageInfo = { token: {}, imageId: 'img-1' } as never;

function show(muya: Muya, reference: HTMLElement, block: Format) {
    muya.eventCenter.emit('muya-transformer', { block, reference, imageInfo });
}

function dismiss(muya: Muya) {
    muya.eventCenter.emit('muya-transformer', { reference: null });
}

function bars(): HTMLElement[] {
    return Array.from(document.querySelectorAll('.mu-transformer .bar'));
}

// muya's isMouseEvent narrows on the `x` alias, which happy-dom's MouseEvent
// omits — define it so the handlers accept the synthetic events.
function mouse(type: string, clientX = 0): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
    Object.defineProperty(event, 'x', { value: clientX });
    return event;
}

describe('image resize bar — dismissal races (#4995)', () => {
    it('a dismissal between the show event and the queued render does not throw', () => {
        const muya = boot('foo');
        bootedBars.push(new ImageResizeBar(muya));

        show(muya, makeReference(), stubBlock());
        dismiss(muya);

        // Runs the queued _render with a null reference.
        expect(() => vi.runAllTimers()).not.toThrow();
        expect(bars()).toHaveLength(0);
    });

    it('a dismissal mid-drag detaches the drag listeners and survives a trailing mousemove', () => {
        const muya = boot('foo');
        bootedBars.push(new ImageResizeBar(muya));

        show(muya, makeReference(), stubBlock());
        vi.runAllTimers();
        expect(bars()).toHaveLength(2);

        const right = document.querySelector('.mu-transformer .bar.right')!;
        right.dispatchEvent(mouse('mousedown'));

        // The image is deleted under the pointer: bars vanish, reference nulls.
        dismiss(muya);
        expect(bars()).toHaveLength(0);

        expect(() => {
            document.body.dispatchEvent(mouse('mousemove', 300));
            document.body.dispatchEvent(mouse('mouseup'));
        }).not.toThrow();
    });

    it('an undisturbed drag still commits the new width', () => {
        const muya = boot('foo');
        bootedBars.push(new ImageResizeBar(muya));

        const block = stubBlock();
        show(muya, makeReference(), block);
        vi.runAllTimers();

        const right = document.querySelector('.mu-transformer .bar.right')!;
        right.dispatchEvent(mouse('mousedown'));
        document.body.dispatchEvent(mouse('mousemove', 300));
        document.body.dispatchEvent(mouse('mouseup'));

        // happy-dom rects are all zeros, so the computed width is
        // max(300 - 0 - 5, 50) = 295.
        expect(block.updateImage).toHaveBeenCalledWith(imageInfo, 'width', '295');
        expect(bars()).toHaveLength(0);
    });
});
