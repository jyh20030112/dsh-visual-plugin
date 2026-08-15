/**
 * Standalone tsdown build for the dsh-visual-plugin dual-half bundle.
 *
 * - Host half:  src/index.ts        -> lib/index.js   (ESM, node; @deepseek-ai/* externals)
 * - Browser half: src/client/index.ts -> lib/client.js (CJS closure-factory for the
 *   client module system: window.__ModuleLoader__.load({id, factory}) with the
 *   platform-module externals resolved from the loader's module table).
 *
 * CSS Modules are inlined by the virtual plugin below (lightningcss), emitting
 * the hashed class map and injecting one <style data-plugin> tag per module,
 * mirroring packages/client/tsdown.client.ts in the harness repository.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Plugin id stamped into the __ModuleLoader__.load handoff and style tags. */
const ID = 'dsh-visual-plugin'

/** Shared browser platform modules (mirror of packages/client/web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

/** Runtime store engine rides the documented exemption in the harness preset. */
const RUNTIME_STORE_EXEMPTION = '@deepseek-ai/dsh-client-runtime/client'

/** Externals resolved from the loader module table. */
export const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, RUNTIME_STORE_EXEMPTION]

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * Project root. CSS-module hashes and virtual ids are expressed relative to it
 * so the committed lib/client.js bundle is byte-identical regardless of where
 * the checkout lives (lightningcss hashes `filename` relative to `projectRoot`,
 * and an absolute path in either would churn the artifact per machine).
 */
const ROOT = fileURLToPath(new URL('.', import.meta.url))

/** Resolve a module.css import against its importer's directory. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolve(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolve(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}

/** Inline CSS Modules: hashed class map + <style data-plugin> injection. */
const cssModulesPlugin: NonNullable<UserConfig['plugins']>[number] = {
  name: 'dsh-css-modules-inline',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css')) return null
    const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
    const rel = relative(ROOT, abs).split(sep).join('/')
    return CSS_VIRTUAL_PREFIX + rel + CSS_VIRTUAL_SUFFIX
  },
  async load(virtualId: string) {
    if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
    const relId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
    const absId = resolve(ROOT, relId)
    this.addWatchFile(absId)
    const source = await readFile(absId)
    const { code, exports: cssExports } = transform({
      filename: absId,
      projectRoot: ROOT,
      code: source,
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    // lightningcss returns the export map from a HashMap with per-call
    // randomized iteration order; sort so the class map (and thus the emitted
    // JSON) is byte-stable across builds.
    const classMap: Record<string, string> = {}
    for (const local of Object.keys(cssExports ?? {}).sort()) classMap[local] = cssExports[local].name
    const tagId = `${ID}/${basename(absId)}`
    return [
      `const css = ${JSON.stringify(code.toString())};`,
      `const tagId = ${JSON.stringify(tagId)};`,
      'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
      '  const tag = document.createElement(\'style\');',
      `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
      '  tag.dataset.pluginCss = tagId;',
      '  tag.textContent = css;',
      '  document.head.appendChild(tag);',
      '}',
      `export default ${JSON.stringify(classMap)};`,
    ].join('\n')
  },
}

/** Host half: ESM node bundle; every @deepseek-ai dependency stays external. */
const host: UserConfig = {
  name: ID,
  entry: { index: 'src/index.ts', invariant: 'src/invariant.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: true,
  dts: false,
  clean: false,
  external: [/^@deepseek-ai\//, /^node:/],
  outputOptions: {
    entryFileNames: (chunk) => `${chunk.name}.js`,
  },
}

/** Browser half: closure-factory bundle served as /plugins/<id>/client.js. */
const client: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [cssModulesPlugin],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
