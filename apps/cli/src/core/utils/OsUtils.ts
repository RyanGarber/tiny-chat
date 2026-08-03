import { homedir } from "node:os";
import { resolve } from "node:path";

export const OsUtils = {
	resolve: (...paths: string[]) => {
		return resolve(
			...paths.map((path) => path.replace(/(^~[^/]*|%HOMEPATH%)/, homedir())),
		);
	},
} as const;
