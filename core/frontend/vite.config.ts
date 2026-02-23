import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
    base: "./",
    plugins: [react(), tsconfigPaths()],
    clearScreen: false,
    define: {
        __TAURI_DEV_HOST__: host ? `"${host}"` : undefined
    },
    envDir: "../../",
    build: {
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    const path = id.split('/');
                    const module = path[path.indexOf('node_modules') + 1];
                    if (path.includes('node_modules')) {
                        //if (module.startsWith('react')) return 'vendor-react';
                        if (module.startsWith('slate')) return 'vendor-slate';
                        if (module.startsWith('@mantine')) return 'vendor-mantine';
                        if (module.startsWith('highlight.js')) return 'vendor-hljs';
                        if (module.startsWith('@google')) return 'vendor-google';
                        if (module.startsWith('openai')) return 'vendor-openai';
                        return 'vendor-core';
                    }
                },
            },
        },
        chunkSizeWarningLimit: 1000
    },
    server: {
        port: parseInt(process.env.VITE_WEB_PORT),
        strictPort: true,
        host: "0.0.0.0",
        hmr: host
            ? {
                protocol: "ws",
                host: host, // must stay here
                port: parseInt(process.env.VITE_WEB_PORT) + 1,
            }
            : undefined,
    },
    cacheDir: "../../node_modules/.vite"
}));
