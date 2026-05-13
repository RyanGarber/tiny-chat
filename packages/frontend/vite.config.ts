import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import tailwindcssMantine from 'tailwind-preset-mantine/vite';
import visualizer from 'rollup-plugin-visualizer';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  base: './',
  clearScreen: false,
  define: {
    __TAURI_DEV_HOST__: host ? `"${host}"` : undefined,
  },
  envDir: '../../',
  plugins: [
    react(),
    tailwindcss(),
    tailwindcssMantine({ input: 'src/theme.tsx' }),
    tsconfigPaths(),
    visualizer({
      filename: 'dist/stats.html',
      template: 'network',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
      external: ['fs', 'path', 'os', 'util'],
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

function getModule(id: string): string | undefined {
  const path = id.split(/[/\\]/);
  const i = path.lastIndexOf('node_modules');
  if (i === -1) return undefined;
  const isScoped = path[i + 1]?.startsWith('@');
  return isScoped ? `${path[i + 1]}/${path[i + 2]}` : path[i + 1];
}

function isMermaid(id: string, mod: string | undefined): boolean {
  if (mod === '@streamdown/mermaid' || mod === 'mermaid' || mod?.startsWith('@mermaid-js')) {
    return true;
  }
  if (
    mod?.startsWith('cytoscape') ||
    mod?.startsWith('dagre') ||
    mod?.startsWith('@dagrejs') ||
    mod === 'd3' ||
    mod?.startsWith('d3-') ||
    mod?.startsWith('cose-') ||
    mod?.startsWith('layout-base')
  ) {
    return true;
  }
  return id.includes('/mermaid/');
}

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  // Each shiki grammar is its own chunk (~4–760 KB).
  const shikijsLang = id.match(/@shikijs\/langs\/dist\/([^./]+)\.mjs/);
  if (shikijsLang) return `vendor-shiki-${shikijsLang[1]}`;

  if (id.includes('onig.wasm') || id.endsWith('.wasm')) {
    return 'vendor-shiki-wasm';
  }

  const mod = getModule(id);

  // Mermaid ecosystem — keep in two chunks to avoid circular imports between sub-chunks.
  if (isMermaid(id, mod)) {
    if (
      mod?.startsWith('cytoscape') ||
      mod?.startsWith('dagre') ||
      mod?.startsWith('@dagrejs') ||
      mod === 'd3' ||
      mod?.startsWith('d3-') ||
      mod?.startsWith('cose-') ||
      mod?.startsWith('layout-base')
    ) {
      return 'vendor-mermaid-deps';
    }
    return 'vendor-mermaid';
  }

  if (!mod) return undefined;

  if (mod === 'react' || mod === 'react-dom' || mod === 'scheduler') {
    return 'vendor-react';
  }

  if (mod.startsWith('slate')) {
    return 'vendor-slate';
  }

  if (mod.startsWith('@mantine') || mod === '@gfazioli/mantine-json-tree') {
    return 'vendor-mantine';
  }

  if (mod.startsWith('@tauri-apps')) {
    return 'vendor-tauri';
  }

  if (mod.startsWith('@trpc') || mod.startsWith('@tanstack')) {
    return 'vendor-data';
  }

  if (mod === 'ai' || mod.startsWith('@ai-sdk')) {
    return 'vendor-ai';
  }

  if (mod === 'better-auth' || mod.startsWith('better-auth') || mod.startsWith('@better-auth')) {
    return 'vendor-auth';
  }

  if (mod.startsWith('@vidstack')) {
    return 'vendor-vidstack';
  }

  if (mod.startsWith('@iconify')) {
    return 'vendor-iconify';
  }

  if (
    [
      'zustand',
      'dayjs',
      'rrule',
      'timeago.js',
      '@use-gesture/react',
      'react-diff-viewer-continued',
    ].includes(mod)
  ) {
    return 'vendor-utils';
  }

  if (mod === '@streamdown/code') {
    return 'vendor-shiki-code';
  }

  if (
    mod === 'shiki' ||
    mod.startsWith('@shikijs') ||
    mod.startsWith('vscode-') ||
    mod.includes('oniguruma')
  ) {
    return 'vendor-shiki-core';
  }

  if (
    mod === 'streamdown' ||
    mod === '@streamdown/math' ||
    mod.startsWith('remark') ||
    mod.startsWith('rehype') ||
    mod.startsWith('unified') ||
    mod.startsWith('mdast') ||
    mod.startsWith('hast') ||
    mod.startsWith('unist') ||
    mod.startsWith('micromark') ||
    mod.startsWith('vfile') ||
    mod === 'marked' ||
    mod === 'katex'
  ) {
    return 'vendor-markdown';
  }

  if (mod === 'superjson' || mod === 'zod') {
    return 'vendor-utils';
  }

  return 'vendor-misc';
}
