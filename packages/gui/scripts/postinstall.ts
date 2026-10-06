import { execSync } from "node:child_process";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";

if (
	!CommonUtils.isTruthy(process.env.CI) ||
	CommonUtils.isTruthy(process.env.CI_TESTING)
) {
	execSync("playwright install --with-deps --no-shell chromium", {
		stdio: "inherit",
	});
} else {
	console.log(":: skipping playwright");
}
