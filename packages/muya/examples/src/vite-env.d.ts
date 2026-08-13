/// <reference types="vite/client" />

import type { Muya } from '@muyajs/core';

declare global {
    interface Window {
        // Debugging handle assigned by main.ts so the editor instance is
        // reachable from the browser devtools console.
        muya?: Muya;
    }
}
