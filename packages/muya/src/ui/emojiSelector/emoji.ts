import type { Emoji as EmojiType } from '../../config/emojis';

// The full table and the fuzzy matcher are ~280KB together and only the picker
// needs them, so they are pulled in the first time the user opens it rather
// than at startup. Rendering `:alias:` in a document goes through the much
// smaller alias map instead (`utils/emoji`).
let indexPromise: Promise<{
    byCategory: Record<string, EmojiType[]>;
    Fuse: typeof import('fuse.js').default;
}> | null = null;

function loadIndex() {
    indexPromise ??= Promise.all([
        import('../../config/emojis'),
        import('fuse.js'),
    ]).then(([{ default: emojis }, { default: Fuse }]) => {
        const byCategory: Record<string, EmojiType[]> = {};
        for (const emoji of emojis) {
            if (byCategory[emoji.category])
                byCategory[emoji.category].push(emoji);
            else
                byCategory[emoji.category] = [emoji];
        }

        return { byCategory, Fuse };
    });

    return indexPromise;
}

class Emoji {
    // cache key is the search text, and the value is search results by category.
    private _cache: Map<string, Record<string, EmojiType[]>> = new Map();

    async search(text: string): Promise<Record<string, EmojiType[]>> {
        const { _cache: cache } = this;
        if (cache.has(text))
            return cache.get(text)!;

        const { byCategory, Fuse } = await loadIndex();
        const result: Record<string, EmojiType[]> = {};

        Object.keys(byCategory).forEach((category) => {
            const fuse = new Fuse(byCategory[category], {
                includeScore: true,
                keys: ['aliases', 'tags'],
            });
            const list = fuse.search(text).map(i => i.item);
            if (list.length)
                result[category] = list;
        });
        cache.set(text, result);

        return result;
    }

    destroy() {
        return this._cache.clear();
    }
}

export default Emoji;
