import { readFileSync } from "node:fs";
import { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	platform: "node",
	target: "node22",
	outDir: "dist",
	clean: true,
	dts: false,
	sourcemap: true,
	splitting: false,
	minify: false,

	banner: {
		js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`,
	},

	esbuildOptions: (options) => {
		options.jsx = "automatic";
	},

	noExternal: ["@tiny-chat/core", "@tiny-chat/client", "@tiny-chat/server"],

	external: ["@napi-rs/keyring", "ai", "@modelcontextprotocol/client"],

	env: {
		...Object.fromEntries(
			Object.entries(zEnv.parse(process.env)).map(([key, value]) => [
				key,
				String(value),
			]),
		),
		DEV: "",
	},

	esbuildPlugins: [
		{
			name: "strip-dotenv",
			setup(build) {
				build.onLoad({ filter: /\/env\.ts$/ }, (args) => {
					const contents = readFileSync(args.path, "utf8");
					if (contents.includes("dotenv") && contents.includes("config(")) {
						return { contents: "", loader: "ts" };
					}
					return undefined;
				});
			},
		},
	],

	onSuccess: "chmod +x dist/index.js",
});
