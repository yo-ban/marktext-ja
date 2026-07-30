import { CLASS_NAMES } from '../config';
import emojiAliases from '../config/emojiAliases';

/**
 * The character `:alias:` stands for, or undefined if no emoji claims it.
 *
 * Backed by the alias map rather than the full table: this runs for every emoji
 * token on every render, and the descriptions and tags only the picker needs
 * would otherwise be part of the startup bundle.
 */
export function emojiForAlias(alias: string): string | undefined {
    // Typed rather than looked up with `hasOwn`: the alias comes from the
    // document, so `:constructor:` and `:toString:` reach here and would
    // otherwise resolve to functions off the prototype.
    const character = emojiAliases[alias];

    return typeof character === 'string' ? character : undefined;
}

/**
 * check edit emoji
 */

export function checkEditEmoji(node: HTMLElement) {
    if (node && node.classList.contains(CLASS_NAMES.MU_EMOJI_MARKED_TEXT))
        return node;

    return false;
}
