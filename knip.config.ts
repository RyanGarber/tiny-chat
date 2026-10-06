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
		// named to Babel in `apps/cli/scripts/compile.ts`, which knip ignores
		"babel-plugin-react-compiler",
	],
	ignoreBinaries: ["run"],
	preprocessor: ["./scripts/setup-knip.ts"],
} satisfies KnipConfig;
