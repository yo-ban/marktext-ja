import { describe, expect, it } from 'vitest';
import emojiAliases from '../emojiAliases';
import emojis from '../emojis';

// `emojiAliases.ts` exists so that rendering `:alias:` does not pull the whole
// picker table into the startup bundle. It is generated from `emojis.ts` by
// `scripts/genEmojiAliases.mjs`, so the two can silently drift when emoji are
// added; this locks them together.
describe('emojiAliases', () => {
    const derived: Record<string, string> = {};
    for (const emoji of emojis) {
        for (const alias of emoji.aliases) {
            if (!(alias in derived))
                derived[alias] = emoji.emoji;
        }
    }

    it('maps every alias in the table to that entry’s character', () => {
        expect(emojiAliases).toStrictEqual(derived);
    });
});
