import type { KnipConfig } from "knip";

export default {
	tags: ["-lintignore"],
	workspaces: {
		".": {},
	},
	ignore: [
		"**/generated/**",
		"**/scripts/**",
		"**/pm2.config.mjs",
		"**/prisma/**",
	],
	ignoreDependencies: [
		"conventional-changelog-conventionalcommits",
		"events",
		"ink-testing-library",
		"babel-plugin-react-compiler",
		"@ryangarber/prisma-orm-extension-zod",
	],
	ignoreBinaries: ["run"],
	preprocessor: ["./scripts/setup-knip.ts"],
} satisfies KnipConfig;
