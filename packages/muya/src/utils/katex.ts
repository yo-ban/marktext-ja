import type KatexModule from 'katex';

type Katex = typeof KatexModule;

// KaTeX with its mhchem extension is ~520KB of the startup bundle, and a
// document without a single `$` never touches it. It is loaded the first time
// something has math to render; until it arrives, the math paths fall back to
// showing the source and re-render once it lands.
let loaded: Katex | null = null;
let pending: Promise<Katex> | null = null;

/**
 * The KaTeX module if it is already in memory, `null` while it still has to be
 * fetched. Render paths that cannot wait use this and fall back to the source.
 */
export function katexIfLoaded(): Katex | null {
    return loaded;
}

/**
 * Load KaTeX, or resolve immediately if it is already loaded. Concurrent
 * callers share the one import.
 */
export function ensureKatex(): Promise<Katex> {
    pending ??= Promise.all([
        import('katex'),
        // mhchem registers `\ce` and friends on the KaTeX it imports itself,
        // so it has to be pulled in alongside rather than after.
        import('katex/dist/contrib/mhchem.mjs'),
        import('katex/dist/katex.min.css'),
    ]).then(([katex]) => {
        loaded = katex.default;

        return loaded;
    });

    return pending;
}
