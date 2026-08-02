import { katexIfLoaded } from '../../katex';

export interface IMathToken {
    type: 'inlineMath' | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    mathStyle?: '' | 'gitlab';
}

interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
    inlineMath?: boolean;
}

const inlineStartRule = /(\s|^)\${1,2}(?!\$)/;
const inlineRule
    = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:]|$)/;
const blockRule = /^(\${1,2})\n((?:\\[\s\S]|[^\\])+?)\n\1[ \t]*(?:\n|$)/;

const DEFAULT_OPTIONS = {
    throwOnError: false,
    useKatexRender: false,
    inlineMath: true,
};

export default function (options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [
            inlineKatex(createRenderer(opts, false), opts.inlineMath),
            blockKatex(createRenderer(opts, true)),
        ],
    };
}

function createRenderer(options: IOptions, newlineAfter: boolean) {
    return (token: IMathToken) => {
        const { useKatexRender, ...otherOpts } = options;
        const { type, text, displayMode, mathStyle } = token;
        // KaTeX is loaded on demand, and this renderer cannot wait for it.
        // Callers that need rendered math await `ensureKatex()` first; without
        // it the formula falls back to its source, same as `useKatexRender:
        // false`.
        const katex = useKatexRender ? katexIfLoaded() : null;
        if (katex) {
            return (
                katex.renderToString(text, {
                    ...otherOpts,
                    displayMode,
                }) + (newlineAfter ? '\n' : '')
            );
        }
        else {
            return type === 'inlineMath'
                ? `$${text}$`
                : `<pre class="multiple-math" data-math-style="${mathStyle}">${text}</pre>\n`;
        }
    };
}

// `singleDollar: false` (the #5004 `inlineMath` toggle) rejects only `$...$`
// matches; same-line `$$...$$` belongs to the display-math feature and must
// keep rendering — the WYSIWYG lexer (`execInlineDisplayMath`) applies the
// same gating, so live editing and static HTML/export stay consistent.
function inlineKatex(renderer: (token: IMathToken) => string, singleDollar = true) {
    return {
        name: 'inlineMath',
        level: 'inline' as const,
        start(src: string) {
            // Scan forward past candidates the tokenizer would reject (a
            // single-dollar match while `singleDollar` is off): returning a
            // rejected index makes marked consume it as plain text without
            // ever reaching a later `$$` span on the same line.
            let offset = 0;
            while (offset < src.length) {
                const rest = src.substring(offset);
                const match = rest.match(inlineStartRule);
                if (!match)
                    return;

                const index = (match.index || 0) + match[1].length;
                const candidate = rest.substring(index).match(inlineRule);
                if (candidate && (singleDollar || candidate[1].length === 2))
                    return offset + index;

                offset += index + 1;
            }
        },
        tokenizer(src: string) {
            const match = src.match(inlineRule);
            if (match) {
                const displayMode = match[1].length === 2;
                if (!singleDollar && !displayMode)
                    return;

                return {
                    type: 'inlineMath',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode,
                };
            }
        },
        renderer,
    };
}

function blockKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'multiplemath',
        level: 'block' as const,
        start(src: string) {
            return src.indexOf('\n$');
        },
        tokenizer(src: string) {
            const match = src.match(blockRule);
            if (match) {
                return {
                    type: 'multiplemath',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode: match[1].length === 2,
                    mathStyle: '',
                };
            }
        },
        renderer,
    };
}
