import { homedir } from "node:os";
import { resolve } from "node:path";

export const CliUtils = {
	/**
	 * Clean up escape sequences from text fields caused by {@link useScrollWheel}.
	 */
	// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
	clean: (value: string) => value.replace(/\x1b?\[<(\d+);(\d+);(\d+)[Mm]/g, ""),

	/**
	 * Resolve one or more paths to an absolute one, accounting for common OS variables.
	 */
	resolve: (...paths: string[]) => {
		return resolve(
			...paths.map((path) => path.replace(/(^~[^/]*|%HOMEPATH%)/, homedir())),
		);
	},
} as const;
