import katex from 'katex';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureKatex } from '../../../../utils/katex';

describe('mhchem (\\ce) extension registration', () => {
    // mhchem is loaded alongside KaTeX and registers `\ce` on it, so the
    // macros exist only once the on-demand load has finished.
    beforeAll(async () => {
        await ensureKatex();
    });

    it('patches the same katex instance the renderers use', () => {
        expect(() =>
            katex.renderToString('\\ce{Zn^2+ <=> Zn(OH)2}', {
                displayMode: true,
            }),
        ).not.toThrow();
    });
});
