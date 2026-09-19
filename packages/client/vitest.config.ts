import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config.base.ts";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			globalSetup: ["../../scripts/setup-test.ts"],
			setupFiles: ["./src/tests.ts"],
		},
	}),
);
