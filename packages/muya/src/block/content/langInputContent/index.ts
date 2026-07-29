import type { Muya } from '../../../muya';
import type { IRenderCursor } from '../../../selection/types';
import type { ICodeBlockState } from '../../../state/types';
import type CodeBlock from '../../commonMark/codeBlock';
import { CLASS_NAMES } from '../../../config';
import Content from '../../base/content';
import { escapeLangInputInnerHtml } from './escape';

class LangInputContent extends Content {
    public override parent: CodeBlock | null = null;

    static override blockName = 'language-input';

    static create(muya: Muya, state: ICodeBlockState) {
        const content = new LangInputContent(muya, state);

        return content;
    }

    constructor(muya: Muya, { meta }: ICodeBlockState) {
        super(muya, meta.lang);
        this.classList = [...this.classList, CLASS_NAMES.MU_LANGUAGE_INPUT];
        this.attributes.hint = muya.i18n.t('Input Language Identifier...');
        this.createDomNode();
    }

    override getAnchor() {
        return this.parent;
    }

    override update(_cursor?: IRenderCursor, highlights = []) {
        this.domNode!.innerHTML = escapeLangInputInnerHtml(this.text, highlights);
    }

    /**
     * Update this block lang and parent's lang, and show/hide language selector.
     * @param lang
     * @param needRender Pass false to keep the current DOM and caret — required
     * on an IME commit, where rebuilding `innerHTML` destroys the text node the
     * IME is still anchored to (#4851).
     */
    private _updateLanguage(lang: string, needRender = true) {
        const cursor = needRender ? this.getCursor() : null;
        this.text = lang;
        this.parent!.lang = lang;
        if (cursor) {
            const startOffset = Math.min(lang.length, cursor.start.offset);
            const endOffset = Math.min(lang.length, cursor.end.offset);
            this.setCursor(startOffset, endOffset, true);
        }
        this.muya.eventCenter.emit('content-change', { block: this });
    }

    // Public entry for setting the language programmatically (e.g. pasting into
    // the language input), so the code block re-highlights and `parent.lang`
    // updates; the DOM input handlers use `_updateLanguage` directly.
    updateLanguage(lang: string): void {
        this._updateLanguage(lang);
    }

    override inputHandler(event: Event) {
        // Composition updates arrive as one `input` per candidate keystroke
        // while the composition is still open; committing them would rebuild
        // `innerHTML` and break the IME. Commit once on compositionend instead
        // (composeHandler calls inputHandler after clearing isComposed).
        if (this.isComposed)
            return;

        const textContent = this.domNode!.textContent ?? '';
        // Store the whole info string; the language is derived as its first word
        // elsewhere (`firstWordOfInfo`). Previously this truncated at the first
        // whitespace, which dropped `title="x"` / Pandoc attributes on edit.
        // An IME commit must keep the live text node for the next character's
        // composition, so it updates state without re-rendering.
        this._updateLanguage(textContent, !this._isImeCommit(event));
    }

    // Mirrors CodeBlockContent._isImeCommit — a compositionend, or the trailing
    // `insertCompositionText` input Chromium fires right after it.
    private _isImeCommit(event: Event): boolean {
        if (event.type === 'compositionend')
            return true;

        return 'inputType' in event
            && (event as InputEvent).inputType === 'insertCompositionText';
    }

    override enterHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        const { parent } = this;
        parent!.lastContentInDescendant()?.setCursor(0, 0);
    }

    override backspaceHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        const { text } = this;
        // The next if statement is used to fix Firefox compatibility issues
        if (start.offset === 1 && end.offset === 1 && text.length === 1) {
            event.preventDefault();
            const lang = '';
            this._updateLanguage(lang);
        }
        if (start.offset === 0 && end.offset === 0) {
            event.preventDefault();
            const cursorBlock = this.previousContentInContext();
            // The cursorBlock will be null, if the code block is the first block in doc.
            if (cursorBlock) {
                const offset = cursorBlock.text.length;
                cursorBlock.setCursor(offset, offset, true);
            }
        }
    }
}

export default LangInputContent;
