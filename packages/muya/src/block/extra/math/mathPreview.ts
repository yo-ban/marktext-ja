import type { Muya } from '../../../muya';
import type { IMathBlockState, TState } from '../../../state/types';
import { fromEvent } from 'rxjs';
import { CLASS_NAMES } from '../../../config';
import { escapeHTML } from '../../../utils';
import { ensureKatex, katexIfLoaded } from '../../../utils/katex';
import logger from '../../../utils/logger';
import Parent from '../../base/parent';

const debug = logger('mathPreview:');

class MathPreview extends Parent {
    private _math: string;

    static override blockName = 'math-preview';

    static create(muya: Muya, state: IMathBlockState) {
        const mathBlock = new MathPreview(muya, state);

        return mathBlock;
    }

    override get path() {
        debug.warn('You can never call `get path` in htmlPreview');
        return [];
    }

    constructor(muya: Muya, { text }: IMathBlockState) {
        super(muya);
        this.tagName = 'div';
        this._math = text;
        this.classList = ['mu-math-preview'];
        this.attributes = {
            spellcheck: 'false',
            contenteditable: 'false',
        };
        this.createDomNode();
        this._attachDOMEvents();
        this.update();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in mathPreview');
        return {} as TState;
    }

    private _attachDOMEvents() {
        const clickObservable = fromEvent(this.domNode!, 'click');
        clickObservable.subscribe(this.clickHandler.bind(this));
    }

    clickHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        const cursorBlock = this.parent!.firstContentInDescendant();
        cursorBlock?.setCursor(0, 0);
    }

    update(math = this._math) {
        if (this._math !== math)
            this._math = math;

        const { i18n } = this.muya;

        if (math) {
            const katex = katexIfLoaded();
            if (!katex) {
                // Show the source until KaTeX arrives, then draw it properly.
                this.domNode!.innerHTML = `<div class="${CLASS_NAMES.MU_MATH_TEXT}">${escapeHTML(math)}</div>`;
                ensureKatex()
                    .then(() => {
                        // The block can be gone by the time KaTeX lands, and
                        // the formula can have been edited since.
                        if (this.domNode && this._math === math)
                            this.update(math);
                    })
                    .catch((err) => {
                        debug.error('Failed to load KaTeX', err);
                    });

                return;
            }

            try {
                const html = katex.renderToString(math, {
                    displayMode: true,
                });
                this.domNode!.innerHTML = html;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : i18n.t('Invalid Mathematical Formula');
                this.domNode!.innerHTML = `<div class="${CLASS_NAMES.MU_MATH_ERROR}">${escapeHTML(message)}</div>`;
            }
        }
        else {
            this.domNode!.innerHTML = `<div class="${CLASS_NAMES.MU_EMPTY}">&lt; ${i18n.t(
                'Empty Mathematical Formula',
            )} &gt;</div>`;
        }
    }
}

export default MathPreview;
