import { Command } from "@commander-js/extra-typings";
import { main } from "#cli/main.tsx";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { createLogger } from "#core/logger.ts";
import tauri from "../../app/tauri.conf.json" with { type: "json" };

createLogger({
	logToDisk: true,
	silent: !CommonUtils.isTruthy(process.env.DEV),
});

const cli = new Command()
	.name("tiny-chat")
	.description("Tiny Chat in the terminal.")
	.version(
		tauri.version + (CommonUtils.isTruthy(process.env.DEV) ? "-dev" : ""),
	)
	.option(
		"--no-keyring",
		"Store the session token in a plain-text OS temp file instead of the keyring",
	);

cli.action(async (options) => {
	await main(options.keyring);
});

export { cli };
