import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  base: './',
  plugins: [react(), tsconfigPaths()],
  clearScreen: false,
  define: {
    __TAURI_DEV_HOST__: host ? `"${host}"` : undefined,
  },
  envDir: '../../',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const path = id.split('/');
          const i = path.lastIndexOf('node_modules');
          if (i === -1) return undefined;

          const isScoped = path[i + 1]?.startsWith('@');
          const module = isScoped ? `${path[i + 1]}/${path[i + 2]}` : path[i + 1];

          if (module === 'react' || module === 'react-dom' || module === 'scheduler') {
            return 'vendor-react';
          }

          if (module?.startsWith('slate')) return 'vendor-slate';
          if (module?.startsWith('@mantine')) return 'vendor-mantine';
          if (module?.startsWith('highlight.js')) return 'vendor-hljs';
          if (module === 'katex') return 'vendor-katex';
          if (module?.startsWith('@tauri-apps')) return 'vendor-tauri';

          if (
            module === 'react-markdown' ||
            module?.startsWith('remark') ||
            module?.startsWith('rehype') ||
            module?.startsWith('unified') ||
            module?.startsWith('micromark') ||
            module?.startsWith('mdast') ||
            module?.startsWith('hast') ||
            module?.startsWith('vfile') ||
            module?.startsWith('unist') ||
            module?.startsWith('property-information') ||
            module === 'html-url-attributes' ||
            module === 'zwitch' ||
            module === 'bail' ||
            module === 'extend' ||
            module === 'trough' ||
            module === 'is-plain-obj' ||
            module === 'comma-separated-tokens' ||
            module === 'space-separated-tokens' ||
            module === 'stringify-entities' ||
            module === 'character-entities' ||
            module === 'devlop'
          ) {
            return 'vendor-markdown';
          }

          if (
            module?.startsWith('@trpc') ||
            module?.startsWith('@tanstack') ||
            module === 'superjson' ||
            module === 'zod'
          ) {
            return 'vendor-data';
          }

          return 'vendor-misc';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: parseInt(process.env.VITE_WEB_PORT),
    strictPort: true,
    host: '0.0.0.0',
    hmr: host
      ? {
          protocol: 'ws',
          host: host, // must stay here
          port: parseInt(process.env.VITE_WEB_PORT) + 1,
        }
      : undefined,
  },
  cacheDir: '../../node_modules/.vite',
}));
