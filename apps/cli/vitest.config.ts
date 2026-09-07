import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.config.base.ts";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			include: ["**/*.test.tsx"],
			setupFiles: ["./src/tests.tsx"],
		},
	}),
);
