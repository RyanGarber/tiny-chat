import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config.base.ts";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			globalSetup: ["./src/tests.global.ts"],
			setupFiles: ["./src/tests.ts"],
		},
	}),
);
