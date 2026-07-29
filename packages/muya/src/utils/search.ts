import type { IMatch, ISearchOption } from '../search/types';
import execAll from 'execall';

export function matchString(text: string, value: string, options: ISearchOption) {
    const { isCaseSensitive, isWholeWord, isRegexp } = options;

    const SPECIAL_CHAR_REG = /[[\]\\^$.|?*+()/]/g;

    let SEARCH_REG = null;
    let regStr = value;
    let flag = 'g';

    if (!isCaseSensitive)
        flag += 'i';

    if (!isRegexp) {
        regStr = value.replace(SPECIAL_CHAR_REG, (p) => {
            return p === '\\' ? '\\\\' : `\\${p}`;
        });
    }

    if (isWholeWord) {
        if (isRegexp) {
            regStr = `\\b${regStr}\\b`;
        }
        else {
            // `\b` only exists next to ASCII word characters, so wrapping a
            // CJK term in `\b...\b` can never match ("whole word" has no
            // meaning without word delimiters). Anchor each side only when
            // that side of the term is an ASCII word character.
            const head = /^\w/.test(value) ? '\\b' : '';
            const tail = /\w$/.test(value) ? '\\b' : '';
            regStr = `${head}${regStr}${tail}`;
        }
    }

    try {
    // Add try catch expression because not all string can generate a valid RegExp. for example `\`.
        SEARCH_REG = new RegExp(regStr, flag);

        return execAll(SEARCH_REG, text);
    }
    catch {
        return [];
    }
}

export function buildRegexValue(match: IMatch, value: string) {
    const groups = value.match(/(?<!\\)\$\d/g);

    if (Array.isArray(groups) && groups.length) {
        for (const group of groups) {
            const index = Number.parseInt(group.replace(/^\$/, ''));
            if (index === 0)
                value = value.replace(group, match.match);
            else if (index > 0 && index <= match.subMatches.length)
                value = value.replace(group, match.subMatches[index - 1]);
        }
    }

    return value;
}
