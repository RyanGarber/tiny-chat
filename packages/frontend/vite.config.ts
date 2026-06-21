import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import tailwindcssMantine from 'tailwind-preset-mantine/vite';
import visualizer from 'rollup-plugin-visualizer';
import inspect from 'vite-plugin-inspect';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  base: './',
  clearScreen: false,
  define: {
    __TAURI_DEV_HOST__: host ? `"${host}"` : undefined,
    'import.meta.vitest': 'undefined',
  },
  envDir: '../../',
  plugins: [
    react(),
    tailwindcss(),
    tailwindcssMantine({ input: 'src/theme.tsx' }),
    tsconfigPaths(),
    visualizer({
      filename: 'dist/stats.html',
      template: 'flamegraph',
    }),
    inspect(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ['fs', 'path', 'os', 'util'],
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            '@mantine/core',
            '@mantine/hooks',
            '@mantine/spotlight',
            '@mantine/modals',
            '@mantine/dates',
            '@mantine/carousel',
            '@mantine/dropzone',
            '@gfazioli/mantine-json-tree',
            'streamdown',
            '@streamdown/math',
            '@streamdown/mermaid',
            '@streamdown/code',
            'katex',
            'ogl',
          ],
          'vendor-llm': ['@mlc-ai/web-llm', '@browser-ai/web-llm'],
        },
      },
    },
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
