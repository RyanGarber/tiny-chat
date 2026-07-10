import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import visualizer from "rollup-plugin-visualizer";
import tailwindcssMantine from "tailwind-preset-mantine/vite";
import { defineConfig } from "vite";
import inspect from "vite-plugin-inspect";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
	base: "./",
	clearScreen: false,
	define: {
		__TAURI_DEV_HOST__: host ? `"${host}"` : undefined,
		"import.meta.vitest": "undefined",
	},
	envDir: "../../",
	plugins: [
		react(),
		tailwindcss(),
		tailwindcssMantine({ input: "src/theme.tsx" }),
		visualizer({
			filename: "dist/stats.html",
			template: "flamegraph",
		}),
		inspect(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		rolldownOptions: {
			external: [/^(node:)?(path|fs)$/],
			output: {
				codeSplitting: {
					groups: [
						{
							name: "react",
							test: /react/i,
						},
						{
							name: "mantine",
							test: /mantine/i,
						},
						{
							name: "streamdown",
							test: /(streamdown|katex|mermaid)/i,
						},
						{
							name: "shiki",
							test: /shiki/i,
							entriesAware: true,
						},
						{
							name: "ai",
							test: /node_modules[\\/](ai[\\/]|@ai-sdk)/i,
						},
						{
							name: "webllm",
							test: /webllm/i,
						},
					],
				},
			},
		},
	},
	server: {
		port: parseInt(process.env.VITE_WEB_PORT as string, 10),
		strictPort: true,
		host: "0.0.0.0",
		hmr: host
			? {
					protocol: "ws",
					host: host, // must stay here
					port: parseInt(process.env.VITE_WEB_PORT as string, 10) + 1,
				}
			: undefined,
	},
	cacheDir: "../../node_modules/.vite",
}));
