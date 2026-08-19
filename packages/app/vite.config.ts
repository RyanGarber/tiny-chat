import ViteTailwind from "@tailwindcss/vite";
import ViteReact from "@vitejs/plugin-react";
import RollupVisualizer from "rollup-plugin-visualizer";
import ViteTailwindMantine from "tailwind-preset-mantine/vite";
import { defineConfig } from "vite";
import ViteInspect from "vite-plugin-inspect";

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
		ViteReact(),
		ViteTailwind(),
		ViteTailwindMantine({ input: "src/theme.tsx" }),
		ViteInspect(),
		RollupVisualizer({
			filename: "dist/stats.html",
			template: "flamegraph",
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		rolldownOptions: {
			external: [/^(node:)?(path|fs)$/],
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
