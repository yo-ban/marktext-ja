// @vitest-environment happy-dom

import type { TState } from '../types';
import { describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { cloneStateTree } from '../cloneState';

describe('cloneStateTree', () => {
    it('deeply isolates state children and metadata without structuredClone', () => {
        const source: TState[] = [
            {
                name: 'order-list',
                meta: { start: 1, loose: false, delimiter: '.' },
                children: [
                    {
                        name: 'list-item',
                        children: [{ name: 'paragraph', text: 'first' }],
                    },
                ],
            },
            {
                name: 'task-list',
                meta: { marker: '-', loose: false },
                children: [
                    {
                        name: 'task-list-item',
                        meta: { checked: false },
                        children: [{ name: 'paragraph', text: 'task' }],
                    },
                ],
            },
        ];
        const structuredCloneSpy = vi.spyOn(globalThis, 'structuredClone');

        const cloned = cloneStateTree(source);

        expect(cloned).toEqual(source);
        expect(cloned).not.toBe(source);
        const clonedOrder = cloned[0] as Extract<TState, { name: 'order-list' }>;
        const sourceOrder = source[0] as Extract<TState, { name: 'order-list' }>;
        const clonedTask = cloned[1] as Extract<TState, { name: 'task-list' }>;
        const sourceTask = source[1] as Extract<TState, { name: 'task-list' }>;
        expect(clonedOrder.meta).not.toBe(sourceOrder.meta);
        expect(clonedOrder.children).not.toBe(sourceOrder.children);
        expect(clonedTask.children[0].meta).not.toBe(sourceTask.children[0].meta);

        clonedOrder.meta.start = 9;
        clonedOrder.children[0].children[0] = { name: 'paragraph', text: 'changed' };
        clonedTask.children[0].meta.checked = true;

        expect(sourceOrder.meta.start).toBe(1);
        expect(sourceOrder.children[0].children[0]).toEqual({ name: 'paragraph', text: 'first' });
        expect(sourceTask.children[0].meta.checked).toBe(false);
        expect(structuredCloneSpy).not.toHaveBeenCalled();
    });

    it('keeps Muya.getState defensive after callers mutate a returned tree', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const muya = new Muya(host, { markdown: '1. first\n2. second\n' } as ConstructorParameters<typeof Muya>[1]);
        muya.init();
        const before = muya.getState();
        const returned = muya.getState();
        const list = returned[0] as Extract<TState, { name: 'order-list' }>;

        list.meta.start = 99;
        (list.children[0] as { meta?: { orderMarker: string } }).meta = { orderMarker: '99)' };
        list.children[0].children[0] = { name: 'paragraph', text: 'mutated' };

        expect(muya.getState()).toEqual(before);
        muya.destroy();
        muya.domNode.remove();
    });

    it('copies array-valued meta fields — mutating a clone never leaks into the source', () => {
        const source: TState[] = [
            {
                name: 'order-list',
                meta: { start: 1, loose: false, delimiter: '.', sourceMarkers: ['1.', '1.'] },
                children: [{ name: 'list-item', children: [{ name: 'paragraph', text: 'a' }] }],
            } as unknown as TState,
        ];

        const clone = cloneStateTree(source);
        const cloneMeta = (clone[0] as { meta: { sourceMarkers: string[] } }).meta;
        cloneMeta.sourceMarkers[0] = '9.';

        const sourceMeta = (source[0] as { meta: { sourceMarkers: string[] } }).meta;
        expect(sourceMeta.sourceMarkers[0]).toBe('1.');
    });

    it('survives pathological nesting without overflowing the call stack (#4747)', () => {
        // 10k-deep single-child chain — far past the ~600 levels that
        // overflowed the recursive implementation.
        let node: TState = { name: 'paragraph', text: 'leaf' } as TState;
        for (let i = 0; i < 10_000; i++)
            node = { name: 'block-quote', children: [node] } as unknown as TState;

        const clone = cloneStateTree([node]);

        let depth = 0;
        let probe = clone[0] as { children?: TState[] };
        while (Array.isArray(probe.children)) {
            probe = probe.children[0] as { children?: TState[] };
            depth++;
        }
        expect(depth).toBe(10_000);
    });
});
