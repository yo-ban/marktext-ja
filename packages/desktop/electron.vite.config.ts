import { resolve, dirname } from 'path'
import { existsSync, readdirSync } from 'fs'
import type { PluginOption } from 'vite'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import postcssPresetEnv from 'postcss-preset-env'
import packageJson from './package.json' with { type: 'json' }
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Every `element-plus/es/components/<name>/style/css` id that exists on disk,
// for optimizeDeps.include (see the comment there).
const elementPlusStyleDeps = (): string[] => {
  const componentsDir = resolve(__dirname, 'node_modules/element-plus/es/components')
  try {
    return readdirSync(componentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => existsSync(resolve(componentsDir, entry.name, 'style/css.mjs')))
      .map((entry) => `element-plus/es/components/${entry.name}/style/css`)
  } catch {
    return []
  }
}

export default defineConfig({
  main: {
    // --> Bundled as CommonJS
    // externalizeDepsPlugin() basically externises all the dependencies from being bundled during build - treating them as runtime dependencies
    // electron-vite still builds the main and preload processes into commonJS
    // hence, we need to "exclude" (in order to NOT externalise) ESonly modules so that they can be converted to commonJS and can be required() afterwards correctly
    build: {
      externalizeDeps: {
        // Bundle electron-store + plist inline so they are available as a
        // CommonJS require() after electron-vite converts the main process
        // output. plist 5 ships ESM-only (no CJS `exports` entry), so leaving
        // it externalized makes the main process `require('plist')` throw
        // ERR_PACKAGE_PATH_NOT_EXPORTED at startup.
        exclude: ['electron-store', 'plist'],
        include: ['native-keymap']
      }
    },
    define: {
      MARKTEXT_VERSION: JSON.stringify(packageJson.version),
      MARKTEXT_VERSION_STRING: JSON.stringify(`v${packageJson.version}`)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        '@shared': resolve(__dirname, 'src/shared')
      },
      extensions: ['.mjs', '.ts', '.js', '.json']
    }
  },
  preload: {
    // --> Bundled as CommonJS
    // With sandbox: true the renderer's preload can only `require('electron')`
    // (plus a few built-ins). Inline `pathe` (ESM-only) so the bundled preload
    // doesn't try to require it from node_modules at runtime.
    build: {
      externalizeDeps: {
        exclude: ['pathe']
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        '@shared': resolve(__dirname, 'src/shared')
      },
      extensions: ['.mjs', '.ts', '.js', '.json']
    }
  },
  renderer: {
    // --> Bundled as ES Modules
    // The renderer runs in a sandboxed Chromium context (contextIsolation: true,
    // nodeIntegration: false, sandbox: true). All Node access must go through
    // the preload → IPC bridge. Aliasing `path` → `pathe` lets the shared
    // `common/*` helpers keep their `import path from 'path'`
    // statements without pulling in Node's path module. `pathe` always uses
    // `/` separators and handles Windows drive letters correctly.
    assetsInclude: ['**/*.md'],
    build: {
      // electron-vite ships with minification off for every process, so the
      // renderer was shipping ~20MB of unminified JS. Minifying it cuts the
      // installed renderer to ~13MB. This is a footprint win only: startup
      // time and RSS were unchanged in measurement, because the renderer's
      // pre-paint cost is top-level module *execution*, not parsing.
      // Main is left unminified — it parses in ~20ms and readable frames
      // matter more there, since it is what crash logs are written from.
      // `keepNames` keeps function and class identifiers in renderer stack
      // traces.
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // @marktext/file-icons is CommonJS, which Rollup cannot split on its
            // own — it merges the module back into whichever chunk imports it,
            // undoing the on-demand import in sideBar/fileIconClass.ts. Naming
            // the chunk explicitly keeps the rule database and its stylesheet
            // out of the startup bundle.
            if (id.includes('@marktext/file-icons')) {
              return 'file-icons'
            }
            return null
          }
        }
      }
    },
    // Some bundled deps (e.g. `custom-event` via `dragula`) reference the
    // Node-only `global` at module load — undefined in a sandboxed renderer.
    // Substitute it with `globalThis` at build time so the imports don't
    // throw before Vue mounts.
    define: {
      global: 'globalThis'
    },
    esbuild: {
      keepNames: true
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        common: resolve(__dirname, 'src/common'),
        '@shared': resolve(__dirname, 'src/shared'),
        path: 'pathe'
      },
      extensions: ['.mjs', '.ts', '.js', '.json', '.vue']
    },
    optimizeDeps: {
      // The Element Plus imports below never appear in source — the Components()
      // resolver injects them at transform time, so Vite's cold-start scan
      // cannot see them. Without pre-bundling, the first window to render a
      // not-yet-used <el-*> (typically the lazily-loaded settings window)
      // triggers "optimized dependencies changed. reloading" mid-mount, and the
      // mixed old/new dep chunks load two Vue runtime copies — every component
      // in the window then crashes with `renderSlot ... reading 'ce'` on null.
      // The per-component style ids are enumerated from disk because a glob
      // cannot express them: the specifier is `.../style/css`, the file
      // `.../style/css.mjs`, and the ids must match the injected specifiers.
      include: ['pako', 'pathe', 'element-plus', 'element-plus/es', ...elementPlusStyleDeps()],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    },
    plugins: [
      vue(),
      svgLoader(),
      // On-demand import of Element Plus components + their styles. Replaces the
      // global `app.use(ElementPlus)` + full `element-plus/dist/index.css`, so
      // each window only bundles the `<el-*>` components it actually renders.
      Components({
        dts: false,
        // Only auto-import Element Plus via the resolver. Disable the default
        // `src/components` directory scan so local components keep using their
        // explicit imports (the scan otherwise globally registers them and
        // triggers naming conflicts, e.g. two `Search` components).
        dirs: [],
        resolvers: [ElementPlusResolver()]
      })
    ] as PluginOption[],
    css: {
      postcss: {
        plugins: [
          postcssPresetEnv({
            stage: 0,
            features: {
              'nesting-rules': true,
              // Electron ships Chromium, which supports CSS logical properties
              // natively. Leave them untouched so `padding-inline-start` /
              // `inset-inline-start` mirror correctly under `dir="rtl"` instead
              // of being down-compiled to hard-coded LTR physical props (#4673).
              'logical-properties-and-values': false
            }
          })
        ]
      }
    }
  }
})
