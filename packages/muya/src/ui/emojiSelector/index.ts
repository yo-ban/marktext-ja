import type { VNode } from 'snabbdom';
import type { Emoji as EmojiType } from '../../config/emojis';
import type { Muya } from '../../index';

import { query } from '../../utils/dom';
import { h, patch } from '../../utils/snabbdom';
import BaseScrollFloat from '../baseScrollFloat';
import Emoji from './emoji';
import './index.css';

const defaultOptions = {
    placement: 'bottom' as const,
    offsetOptions: {
        mainAxis: 12,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

export class EmojiSelector extends BaseScrollFloat {
    static pluginName = 'emojiPicker';
    public override capturesContentKeydown = true;
    private _renderObj: Record<string, EmojiType[]> | null = null;
    private _oldVNode: VNode | null = null;
    private _emoji: Emoji = new Emoji();
    private _queryId = 0;
    public override renderArray: EmojiType[] = [];
    public override activeItem: EmojiType | null = null;

    constructor(muya: Muya) {
        const name = 'mu-emoji-picker';
        super(muya, name, defaultOptions);

        this.listen();
    }

    get renderObj(): Record<string, EmojiType[]> {
        return this._renderObj || {};
    }

    set renderObj(obj: Record<string, EmojiType[]>) {
        this._renderObj = obj;
        const renderArray: EmojiType[] = [];
        Object.keys(obj).forEach((key) => {
            renderArray.push(...obj[key]);
        });
        this.renderArray = renderArray;
        if (this.renderArray.length > 0) {
            this.activeItem = this.renderArray[0];
            const activeEle = this.getItemElement(this.activeItem);
            if (activeEle)
                this.activeEleScrollIntoView(activeEle);
        }
    }

    override listen() {
        super.listen();
        const { eventCenter } = this.muya;
        eventCenter.on('muya-emoji-picker', ({ reference, emojiText, block }) => {
            // The search loads the emoji table on first use, so results can land
            // after the user has typed on — or after the picker should have
            // closed. Only the newest query may paint.
            const queryId = ++this._queryId;
            if (!emojiText)
                return this.hide();
            const text = emojiText.trim();
            if (text) {
                this._emoji.search(text).then((renderObj) => {
                    if (queryId !== this._queryId)
                        return;

                    this.renderObj = renderObj;
                    const cb: (item: EmojiType) => void = (item) => {
                        if (block && block.setEmoji)
                            block.setEmoji(item.aliases[0]);
                    };

                    if (this.renderArray.length) {
                        this.show(reference, cb);
                        this.render();
                    }
                    else {
                        this.hide();
                    }
                });
            }
        });
    }

    render() {
        const { scrollElement, renderObj, activeItem, _oldVNode: oldVNode } = this;
        const { i18n } = this.muya;

        const children = Object.keys(renderObj).map((category) => {
            const title = h('div.title', i18n.t(category) || category);
            const emojis = renderObj[category].map((e: EmojiType) => {
                const selector = activeItem === e ? 'div.item.active' : 'div.item';

                return h(
                    selector,
                    {
                        dataset: { label: e.aliases[0] },
                        props: { title: e.description },
                        on: {
                            click: () => {
                                this.selectItem(e);
                            },
                        },
                    },
                    h('span', e.emoji),
                );
            });

            return h('section', [title, h('div.emoji-wrapper', emojis)]);
        });

        const vnode = h('div', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(scrollElement!, vnode);

        this._oldVNode = vnode;
    }

    getItemElement(item: EmojiType) {
        const label = item.aliases[0];

        return query<HTMLElement>(`[data-label="${label}"]`, this.floatBox!);
    }

    override destroy() {
        super.destroy();
        this._emoji.destroy();
    }
}
