// @vitest-environment happy-dom

import type CodeBlock from '../../../commonMark/codeBlock';
import type LangInputContent from '../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// The code-fence language input had NO composition handling at all: every
// `input` event — including the per-keystroke ones fired while an IME
// composition is open — ran `_updateLanguage`, which rebuilds `innerHTML`
// and destroys the text node the IME is anchored to. Japanese input into
// the language field therefore broke on the very first composed character
// (the same anchor-destruction mechanism as #4851 in code blocks).
//
// The fix mirrors format/codeBlockContent: ignore inputs while composing,
// and commit an IME's final text (compositionend + Chromium's trailing
// `insertCompositionText` input) without re-rendering the DOM.

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

function langInput(muya: Muya): LangInputContent {
    let target: LangInputContent | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'language-input')
            target = block as unknown as LangInputContent;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('language-input block not found');
    return target;
}

const JS_CODE_BLOCK = '```js\nx\n```\n';

describe('langInputContent IME composition', () => {
    it('ignores input events while a composition is open', () => {
        const muya = bootMuya(JS_CODE_BLOCK);
        const content = langInput(muya);

        content.composeHandler(new Event('compositionstart'));
        // The IME mutates the DOM per candidate keystroke; state must not follow.
        content.domNode!.textContent = 'jsに';
        content.inputHandler(new InputEvent('input', {
            inputType: 'insertCompositionText',
            data: 'に',
            isComposing: true,
        }));

        expect(content.text).toBe('js');
        expect((content.parent as CodeBlock).lang).toBe('js');
    });

    it('commits the composed text on compositionend without replacing the text node', () => {
        const muya = bootMuya(JS_CODE_BLOCK);
        const content = langInput(muya);

        content.composeHandler(new Event('compositionstart'));
        content.domNode!.textContent = 'jsに';
        const textNode = content.domNode!.firstChild;

        content.composeHandler(new Event('compositionend'));

        expect(content.text).toBe('jsに');
        expect((content.parent as CodeBlock).lang).toBe('jsに');
        // The IME may immediately open the next character's composition against
        // this node — the commit must not have destroyed it.
        expect(content.domNode!.firstChild).toBe(textNode);
    });

    it('also survives the trailing insertCompositionText input Chromium fires', () => {
        const muya = bootMuya(JS_CODE_BLOCK);
        const content = langInput(muya);

        content.composeHandler(new Event('compositionstart'));
        content.domNode!.textContent = 'jsに';
        const textNode = content.domNode!.firstChild;

        content.composeHandler(new Event('compositionend'));
        content.inputHandler(new InputEvent('input', {
            inputType: 'insertCompositionText',
            data: 'に',
            isComposing: false,
        }));

        expect(content.text).toBe('jsに');
        expect(content.domNode!.firstChild).toBe(textNode);
    });

    it('still re-renders on a normal (non-composition) input', () => {
        const muya = bootMuya(JS_CODE_BLOCK);
        const content = langInput(muya);
        content.setCursor(2, 2, true);

        const updateSpy = vi.spyOn(content, 'update');
        content.inputHandler(new InputEvent('input', {
            inputType: 'insertText',
            data: 's',
            isComposing: false,
        }));

        expect(updateSpy).toHaveBeenCalled();
        expect(content.text).toBe('js');
    });
});
