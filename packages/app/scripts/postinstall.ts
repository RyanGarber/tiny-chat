import { execSync } from "node:child_process";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";

if (
	!CommonUtils.isTruthy(process.env.CI) ||
	// biome-ignore lint/suspicious/noUndeclaredEnvVars: non-testing ci does not need turbo
	CommonUtils.isTruthy(process.env.CI_TESTING)
) {
	execSync("playwright install --with-deps --no-shell chromium", {
		stdio: "inherit",
	});
} else {
	console.log(":: skipping playwright");
}
