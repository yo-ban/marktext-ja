import type FuseType from 'fuse.js';

type FuseConstructor = typeof FuseType;

let loaded: FuseConstructor | null = null;
let pending: Promise<FuseConstructor> | null = null;

/**
 * Fuzzy search is only reachable through two typing-driven menus (the code
 * block language picker and the paragraph quick insert menu), so fuse.js is
 * kept out of the startup bundle and loaded with the first query.
 */
export async function ensureFuse(): Promise<FuseConstructor> {
    pending ??= import('fuse.js').then((mod) => {
        loaded = mod.default;
        return loaded;
    });

    return pending;
}

/**
 * The constructor if a previous {@link ensureFuse} has already resolved,
 * otherwise `null`. Lets synchronous paths skip the microtask hop once the
 * chunk is in memory.
 */
export function fuseIfLoaded(): FuseConstructor | null {
    return loaded;
}
