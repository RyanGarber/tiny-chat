import { defineConfig } from "vitest/config";
export default defineConfig({
	test: {
		include: [
			"packages/core/src/features/data/utils/MessageBranchUtils.test.ts",
			"packages/server/src/features/message/services/MessageService.branch.test.ts",
		],
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
