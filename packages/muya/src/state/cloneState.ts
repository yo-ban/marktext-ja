import type { TState } from './types';

/**
 * Clone Muya's bounded document-state schema without the high fixed cost of
 * structuredClone on Android WebView. State metadata is one level of scalar
 * or array-of-scalar fields; nested document data exists only in `children`
 * arrays.
 */

// Array-valued meta fields (order-list `sourceMarkers`, table `aligns`) must
// be copied too: a shallow `{ ...meta }` left the array SHARED between the
// clone and the live state, so mutating a getState() result corrupted the
// document.
function cloneMeta<T extends Record<string, unknown>>(meta: T): T {
    const copy: Record<string, unknown> = { ...meta };
    for (const key of Object.keys(copy)) {
        const value = copy[key];
        if (Array.isArray(value))
            copy[key] = [...value];
    }
    return copy as T;
}

function cloneShallow(state: TState): TState {
    const copy = { ...state };
    if ('meta' in copy && copy.meta) {
        (copy as { meta: Record<string, unknown> }).meta = cloneMeta(
            copy.meta as Record<string, unknown>,
        );
    }
    return copy;
}

export function cloneStateTree(states: readonly TState[]): TState[] {
    const result = states.map(cloneShallow);

    // Explicit work list instead of recursion: pathological nesting (e.g. a
    // 600-level bullet list, #4747) must not overflow the call stack.
    const pending: TState[] = [...result];
    while (pending.length > 0) {
        const node = pending.pop()! as { children?: TState[] };
        if (Array.isArray(node.children)) {
            node.children = node.children.map(cloneShallow);
            pending.push(...node.children);
        }
    }

    return result;
}
