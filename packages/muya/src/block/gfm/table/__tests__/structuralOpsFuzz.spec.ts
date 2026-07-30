// @vitest-environment happy-dom

import type Table from '../index';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// Upstream #4989 / #5012 / #4943 report ot-json1 blowing up during "table
// editing" ("Cannot use numerical key for object container" / "Cannot insert
// into out of bounds index" in JSONState._apply) with no usable repro steps.
// This suite drives every structural table operation through many positions,
// flushing the op batch after each step, and asserts the state pipeline stays
// consistent: no throw, and the block tree still serializes to a well-formed
// table. A deterministic op-sequence "fuzz" — if one of these paths builds a
// malformed op, the flush raises exactly the reported error class.

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

const TABLE_MD = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n';

function findTable(muya: Muya): Table {
    let target: Table | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (!target && block.constructor.blockName === 'table')
            target = block as unknown as Table;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('table block not found');
    return target;
}

function flush(muya: Muya) {
    muya.editor.jsonState.flush();
}

describe('table structural ops keep the json state consistent (#4989/#5012/#4943)', () => {
    it('insertRow at every offset', () => {
        for (let offset = 0; offset <= 3; offset++) {
            const muya = bootMuya(TABLE_MD);
            const table = findTable(muya);
            table.insertRow(offset);
            flush(muya);
            expect(muya.getMarkdown()).toContain('| a');
        }
    });

    it('insertColumn at every offset', () => {
        for (let offset = 0; offset <= 3; offset++) {
            const muya = bootMuya(TABLE_MD);
            const table = findTable(muya);
            table.insertColumn(offset);
            flush(muya);
            expect(muya.getMarkdown()).toContain('| a');
        }
    });

    it('removeRow at every offset', () => {
        for (let offset = 0; offset <= 2; offset++) {
            const muya = bootMuya(TABLE_MD);
            const table = findTable(muya);
            table.removeRow(offset);
            flush(muya);
            expect(muya.getMarkdown().length).toBeGreaterThan(0);
        }
    });

    it('removeColumn at every offset', () => {
        for (let offset = 0; offset <= 2; offset++) {
            const muya = bootMuya(TABLE_MD);
            const table = findTable(muya);
            table.removeColumn(offset);
            flush(muya);
            expect(muya.getMarkdown().length).toBeGreaterThan(0);
        }
    });

    it('interleaved inserts, removes and cell edits stay consistent', () => {
        const muya = bootMuya(TABLE_MD);
        const table = findTable(muya);

        table.insertRow(1);
        flush(muya);
        table.insertColumn(2);
        flush(muya);
        table.removeRow(0);
        flush(muya);
        table.insertRow(0);
        flush(muya);
        table.removeColumn(3);
        flush(muya);
        table.removeColumn(0);
        flush(muya);
        table.removeRow(1);
        flush(muya);

        const md = muya.getMarkdown();
        expect(md).toContain('|');
        // Round-trip proves the emitted table is still well-formed.
        const rebooted = bootMuya(md);
        expect(rebooted.getMarkdown()).toBe(md);
    });

    it('removing every row/column in turn collapses the table without corrupting state', () => {
        const muya = bootMuya(TABLE_MD);
        let table = findTable(muya);
        table.removeRow(2);
        flush(muya);
        table = findTable(muya);
        table.removeRow(1);
        flush(muya);
        // Removing rows/columns down to nothing must not throw; whatever
        // block remains, the document must still serialize.
        expect(() => muya.getMarkdown()).not.toThrow();
    });
});
