import RolldownBabel from "@rolldown/plugin-babel";
import ViteTailwind from "@tailwindcss/vite";
import ViteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import RolldownVisualizer from "rollup-plugin-visualizer";
import ViteTailwindMantine from "tailwind-preset-mantine/vite";
import { defineConfig, mergeConfig } from "vite";
import ViteInspect from "vite-plugin-inspect";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import baseConfig from "../../vitest.config.base.ts";

const host = process.env.TAURI_DEV_HOST;
const hmr =
	!process.argv.includes("--no-hmr") &&
	!CommonUtils.isTruthy(process.env.NO_HMR);

if (!hmr) {
	console.log(":: disabling hmr");
}

export default mergeConfig(
	baseConfig,
	defineConfig({
		base: "./",
		clearScreen: false,
		define: {
			__TAURI_DEV_HOST__: host ? `"${host}"` : undefined,
			"import.meta.vitest": "undefined",
		},
		envDir: "../../",
		plugins: [
			{
				name: "react-devtools",
				apply: "serve",
				transformIndexHtml: () => [
					{
						tag: "script",
						attrs: { src: "http://localhost:8097" },
						injectTo: "body-prepend",
					},
				],
			},
			ViteReact(),
			RolldownBabel({ presets: [reactCompilerPreset()] }),
			ViteTailwind(),
			ViteTailwindMantine({ input: "src/theme.tsx" }),
			ViteInspect(),
			RolldownVisualizer({
				filename: "dist/stats.html",
				template: "flamegraph",
			}),
		],
		resolve: {
			tsconfigPaths: true,
		},
		worker: {
			// Shiki loads grammars and themes on demand, which needs code splitting
			format: "es",
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
			ws: host
				? {
						protocol: "ws",
						host: host, // must stay here
						port: parseInt(process.env.VITE_WEB_PORT as string, 10) + 1,
					}
				: undefined,
			hmr,
		},
		cacheDir: "../../node_modules/.vite",
		test: {
			setupFiles: ["./src/tests.ts"],
			include: ["**/*.test.tsx"],
			browser: {
				enabled: true,
				provider: playwright({ launchOptions: { channel: "chromium" } }),
				instances: [{ browser: "chromium" }],
			},
		},
	}),
);
