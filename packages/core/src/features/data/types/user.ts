import { z } from "zod";
import { zStringify } from "../../../core/types/common.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { ThemeUtils } from "../../../core/utils/ThemeUtils.ts";
import { zModelFeature } from "../../provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "../../provider/types/provider.ts";
import { zConfig } from "./message.ts";

export const zCache = z.object({
	providers: z.array(z.custom<ProviderState<ProviderStatus>>()).default([]),
});
export type zCache = z.infer<typeof zCache>;

export const zMCPServers = z
	.record(
		z.string().regex(/^[a-z0-9-_]+$/),
		z.union([
			z.object({
				url: z.string(),
				headers: z.record(z.string(), zStringify).optional(),
			}),
			z.object({
				command: z.string(),
				args: z.array(z.string()).optional(),
				env: z.record(z.string(), zStringify).optional(),
			}),
		]),
	)
	.optional();
export type zMCPServers = z.infer<typeof zMCPServers>;

export const zCommand = z.object({
	command: z.string().min(1),
	whitelist: z.boolean(),
});
export type zCommand = z.infer<typeof zCommand>;

export const zFolder = z
	.object({
		path: z.string().min(1),
		whitelist: z.boolean(),
	})
	.catch(({ value }) => {
		console.warn("zFolder: using deprecated writable field");
		const compat = z
			.object({ path: z.string().min(1), writable: z.boolean() })
			.parse(value);
		return {
			path: compat.path,
			whitelist: compat.writable,
		};
	});
export type zFolder = z.infer<typeof zFolder>;

export const zHiddenModels = z.partialRecord(
	zModelFeature.exclude(["language:tools"]),
	z.array(zConfig.pick({ model: true, provider: true })),
);
export type zHiddenModels = z.infer<typeof zHiddenModels>;

export const zSettings = z
	.object({
		instructions: z.array(z.string()),
		commands: z.array(zCommand),
		folders: z.array(zFolder),
		memoryBudget: z.number(),
		useEmbeddingSearch: z.boolean(),
		embeddingConfig: zConfig.nullable(),
		subagentConfig: zConfig.nullable(),
		dreamConfig: zConfig.nullable(),
		preferredWebProvider: z.string().nullable(),
		hiddenModels: zHiddenModels,
		useProviderCache: z.boolean(),
		useBrowserModels: z.boolean(),
		theme: z.enum(ThemeUtils.themes),
		codeTheme: z.enum(ThemeUtils.codeThemes),
		providers: z.record(z.string(), z.any()).optional(),
		mcpServers: zMCPServers,
		presets: z.record(z.string(), zConfig),
	})
	.partial();
export type zSettings = z.infer<typeof zSettings>;

export const zUser = z.object({
	id: z.string(),
	name: z.string().default(CommonUtils.defaultName),
	settings: zSettings,
	isEphemeral: z.boolean().nullable(),
});
export type zUser = z.infer<typeof zUser>;
