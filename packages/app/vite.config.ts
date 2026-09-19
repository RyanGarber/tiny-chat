import RolldownBabel from "@rolldown/plugin-babel";
import ViteTailwind from "@tailwindcss/vite";
import ViteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import RolldownVisualizer from "rollup-plugin-visualizer";
import ViteTailwindMantine from "tailwind-preset-mantine/vite";
import { defineConfig, mergeConfig } from "vite";
import ViteInspect from "vite-plugin-inspect";
import baseConfig from "../../vitest.config.base.ts";

const host = process.env.TAURI_DEV_HOST;

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
		},
		cacheDir: "../../node_modules/.vite",
		test: {
			globalSetup: ["../../scripts/setup-test.ts"],
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
