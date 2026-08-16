import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/terra-invicta-techtree-update/'

// The React app is loaded via dynamic import from the tiny graph-boot entry.
// Preload it (and its CSS) from the HTML head so it downloads in parallel with
// the entry chunk instead of after it.
function preloadAppChunk(): Plugin {
  return {
    name: 'preload-app-chunk',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        const tags = []
        for (const chunk of Object.values(ctx.bundle)) {
          const isAppChunk = chunk.type === 'chunk' &&
            (chunk.facadeModuleId?.endsWith('appMain.tsx') || chunk.moduleIds.some((m) => m.endsWith('appMain.tsx')))
          if (isAppChunk) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'modulepreload', crossorigin: true, href: BASE + chunk.fileName },
              injectTo: 'head' as const,
            })
            for (const css of chunk.viteMetadata?.importedCss ?? []) {
              tags.push({
                tag: 'link',
                attrs: { rel: 'stylesheet', href: BASE + css },
                injectTo: 'head' as const,
              })
            }
          }
        }
        return tags
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadAppChunk()],
  base: BASE,
})
