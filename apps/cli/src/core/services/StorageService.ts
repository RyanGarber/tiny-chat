import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { zConfig } from "#core/features/data/types/message.ts";

export const zStorage = z.looseObject({
	config: zConfig,
});
export type zStorage = z.infer<typeof zStorage>;

const PATH = join(homedir(), ".tiny-chat.json");
const PATH_ALT = join(homedir(), ".tiny-chat.alt.json");

let override: string | null = null;

export const StorageService = {
	path: () => override ?? PATH,

	cache: null as Record<string, unknown> | null,

	getOverride: () => {
		return override;
	},

	setOverride: (value: boolean | string | null) => {
		if (value === true) override = PATH_ALT;
		else if (value === false) override = null;
		else override = value;
		StorageService.cache = null;
	},

	get: <T>(key: keyof zStorage): T | null => {
		if (!existsSync(StorageService.path())) {
			writeFileSync(
				StorageService.path(),
				JSON.stringify(StorageService.cache),
			);
		}
		if (!StorageService.cache) {
			StorageService.cache = JSON.parse(
				readFileSync(StorageService.path(), "utf-8"),
			);
		}
		return (StorageService.cache?.[key] ?? null) as T | null;
	},

	set: <T>(key: keyof zStorage, value: T) => {
		StorageService.cache = { ...StorageService.cache, [key]: value };
		writeFileSync(
			StorageService.path(),
			JSON.stringify(StorageService.cache),
			"utf-8",
		);
	},
};
