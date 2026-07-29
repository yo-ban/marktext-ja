// @vitest-environment happy-dom

import type { Muya } from '../../../index';
import { describe, expect, it, vi } from 'vitest';
import BaseScrollFloat from '../index';

// Arrows/Tab/Enter/Escape pressed while an IME composition is open operate the
// IME's candidate list (navigate / confirm / cancel). When a scroll float
// (emoji selector, quick-insert menu, language selector) is shown, its keydown
// handlers must let those keys through to the IME instead of driving the
// float's own selection or hiding it.

class TestScrollFloat extends BaseScrollFloat {
    render(): void {}
    getItemElement(): HTMLElement | null {
        return null;
    }
}

interface IAttached {
    target: EventTarget;
    type: string;
    handler: (event: Event) => void;
}

function makeFloat() {
    const attached: IAttached[] = [];
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);
    const muya = {
        domNode,
        eventCenter: {
            emit: vi.fn(),
            attachDOMEvent: (target: EventTarget, type: string, handler: (event: Event) => void) => {
                attached.push({ target, type, handler });
            },
        },
    } as unknown as Muya;

    const float = new TestScrollFloat(muya, 'mu-test-scroll-float');
    float.listen();

    // Both the BaseFloat Escape handler and the BaseScrollFloat navigation
    // handler register on the editor domNode.
    const keydownHandlers = attached
        .filter(a => a.target === domNode && a.type === 'keydown')
        .map(a => a.handler);

    const dispatchKeydown = (init: { key: string; isComposing: boolean }) => {
        const event = new KeyboardEvent('keydown', { ...init, bubbles: true });
        for (const handler of keydownHandlers)
            handler(event);
    };

    return { float, dispatchKeydown };
}

describe('scroll float keydown during IME composition', () => {
    it('does not navigate or select while composing', () => {
        const { float, dispatchKeydown } = makeFloat();
        float.status = true;
        float.renderArray = ['a', 'b'];
        float.activeItem = 'a';
        const step = vi.spyOn(float, 'step');
        const selectItem = vi.spyOn(float, 'selectItem');

        dispatchKeydown({ key: 'ArrowDown', isComposing: true });
        dispatchKeydown({ key: 'ArrowUp', isComposing: true });
        dispatchKeydown({ key: 'Tab', isComposing: true });
        dispatchKeydown({ key: 'Enter', isComposing: true });

        expect(step).not.toHaveBeenCalled();
        expect(selectItem).not.toHaveBeenCalled();
    });

    it('does not hide on Escape while composing', () => {
        const { float, dispatchKeydown } = makeFloat();
        float.status = true;
        const hide = vi.spyOn(float, 'hide');

        dispatchKeydown({ key: 'Escape', isComposing: true });

        expect(hide).not.toHaveBeenCalled();
    });

    it('still navigates, selects and hides when not composing', () => {
        const { float, dispatchKeydown } = makeFloat();
        float.status = true;
        float.renderArray = ['a', 'b'];
        float.activeItem = 'a';
        const step = vi.spyOn(float, 'step').mockImplementation(() => {});
        const selectItem = vi.spyOn(float, 'selectItem').mockImplementation(() => {});
        const hide = vi.spyOn(float, 'hide').mockImplementation(() => {});

        dispatchKeydown({ key: 'ArrowDown', isComposing: false });
        expect(step).toHaveBeenCalledWith('next');

        dispatchKeydown({ key: 'Enter', isComposing: false });
        expect(selectItem).toHaveBeenCalled();

        dispatchKeydown({ key: 'Escape', isComposing: false });
        expect(hide).toHaveBeenCalled();
    });
});
