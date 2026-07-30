// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck

import type { Muya } from '../../index';
import './index.css';

function position(source, ele) {
    const rect = source.getBoundingClientRect();
    const { top, right, height } = rect;

    Object.assign(ele.style, {
        top: `${top + height + 15}px`,
        left: `${right - ele.offsetWidth / 2 - 10}px`,
    });
}

class Tooltip {
    private _muya: Muya;
    private _cache: WeakMap<HTMLElement, HTMLElement>;

    constructor(muya) {
        this._muya = muya;
        this._cache = new WeakMap();
        const { domNode, eventCenter } = this._muya;

        eventCenter.attachDOMEvent(
            domNode,
            'mouseover',
            this._mouseOver.bind(this),
        );
    }

    private _mouseOver(event) {
        const { target } = event;
        const toolTipTarget = target.closest('[data-tooltip]');
        if (!toolTipTarget || this._cache.has(toolTipTarget))
            return;

        const tooltipEle = document.createElement('div');
        tooltipEle.textContent = toolTipTarget.getAttribute('data-tooltip');
        tooltipEle.classList.add('mu-tooltip');
        document.body.appendChild(tooltipEle);
        position(toolTipTarget, tooltipEle);

        setTimeout(() => {
            tooltipEle.classList.add('active');
        });

        // A target removed from the document while hovered fires no
        // `mouseleave`, which would strand its tooltip on screen.
        const timer = setInterval(() => {
            if (!document.body.contains(toolTipTarget))
                this._hide(toolTipTarget);
        }, 300);

        this._cache.set(toolTipTarget, { tooltipEle, timer });

        // Bound on the target itself rather than through `eventCenter`: the
        // event center holds every registration, and its target element, for
        // the lifetime of the Muya instance, so a per-element tooltip target
        // registered there would outlive the document that owned it.
        toolTipTarget.addEventListener(
            'mouseleave',
            () => this._hide(toolTipTarget),
            { once: true },
        );
    }

    private _hide(target) {
        const entry = this._cache.get(target);
        if (!entry)
            return;

        clearInterval(entry.timer);
        entry.tooltipEle.remove();
        this._cache.delete(target);
    }
}

export default Tooltip;
