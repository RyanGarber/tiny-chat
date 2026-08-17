#!/usr/bin/env bun

const ENV_KEYS = [
	"VITE_SERVER_URL",
	"VITE_SERVER_PORT",
	"VITE_WEB_URL",
	"VITE_WEB_PORT",
] as const;

const define: Record<string, string> = {};
for (const key of ENV_KEYS) {
	define[`process.env.${key}`] = JSON.stringify(String(process.env[key]));
}
define["process.env.DEV"] = JSON.stringify("");

const result = await Bun.build({
	entrypoints: ["./src/index.ts"],
	compile: {
		outfile: "./dist/tiny-chat",
	},
	define,
});

if (!result.success) {
	for (const message of result.logs) {
		console.error(message);
	}
	process.exit(1);
}
