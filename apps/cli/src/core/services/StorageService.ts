import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { z } from "zod";

export const zStorage = z.looseObject({
	config: zConfig,
});
export type zStorage = z.infer<typeof zStorage>;

const PATH = join(homedir(), ".tiny-chat.json");

export const StorageService = {
	path: PATH,
	cache: null as Record<string, unknown> | null,

	get: <T>(key: keyof zStorage): T | null => {
		if (!existsSync(StorageService.path)) {
			writeFileSync(StorageService.path, JSON.stringify(StorageService.cache));
		}
		if (!StorageService.cache) {
			StorageService.cache = JSON.parse(
				readFileSync(StorageService.path, "utf-8"),
			);
		}
		return (StorageService.cache?.[key] ?? null) as T | null;
	},

	set: <T>(key: keyof zStorage, value: T) => {
		StorageService.cache = { ...StorageService.cache, [key]: value };
		writeFileSync(
			StorageService.path,
			JSON.stringify(StorageService.cache),
			"utf-8",
		);
	},
};
