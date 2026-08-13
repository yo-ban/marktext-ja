import diff from 'fast-diff';
import * as otText from 'ot-text-unicode';
import { describe, expect, it } from 'vitest';
import { diffToTextOp } from '../index';

function applyEdit(before: string, after: string): string {
    return otText.type.apply(before, diffToTextOp(diff(before, after))) as string;
}

describe('diffToTextOp Unicode offsets', () => {
    it.each([
        ['skin-tone + ZWJ emoji', 'A👩🏽‍💻B', 'A👩🏽‍💻!B'],
        ['family ZWJ emoji', 'A👨‍👩‍👧‍👦B', 'A👨‍👩‍👧‍👦!B'],
        ['regional-indicator flag', 'A🇯🇵B', 'A🇯🇵!B'],
        ['combining character', 'Ae\u0301B', 'Ae\u0301!B'],
        ['simple astral emoji', 'A🙂B', 'A🙂!B'],
        ['CJK text', 'A日本語B', 'A日本語!B'],
    ])('edits after a %s at the real code-point boundary', (_label, before, after) => {
        expect(applyEdit(before, after)).toBe(after);
    });

    it('uses code-point counts, not grapheme-cluster or UTF-16 lengths', () => {
        const before = 'A👩🏽‍💻B';
        const after = 'A👩🏽‍💻!B';

        // A + woman + skin tone + ZWJ + laptop = five Unicode code points.
        // Intl.Segmenter reports two graphemes here; String.length reports
        // eight UTF-16 code units. text-unicode accepts neither of those units.
        expect(diffToTextOp(diff(before, after))).toEqual([5, '!']);
    });

    it('omits trailing unchanged text because OT retains the rest implicitly', () => {
        expect(
            diffToTextOp([
                [0, 'prefix'],
                [1, '!'],
                [0, 'a very long unchanged suffix'],
            ]),
        ).toEqual([6, '!']);
        expect(diffToTextOp([[0, 'entirely unchanged']])).toEqual([]);
    });
});
