import { z } from "zod";
import { zStringify } from "../../../core/types/common.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { zModelFeature } from "../../provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "../../provider/types/provider.ts";
import { zConfig } from "./message.ts";

export const zCache = z.object({
	providers: z.array(z.custom<ProviderState<ProviderStatus>>()),
});
export type zCache = z.infer<typeof zCache>;

/** @lintignore */
export const zProviderSettings = z.record(z.string(), z.any()).optional();
export type zProviderSettings = z.infer<typeof zProviderSettings>;

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

export const zHiddenModel = zConfig.pick({ model: true, provider: true });
export type zHiddenModel = z.infer<typeof zHiddenModel>;

/** @lintignore */
export const zHiddenModels = z
	.partialRecord(zModelFeature, z.array(zHiddenModel))
	.default({ language: [], embedding: [] });
export type zHiddenModels = z.infer<typeof zHiddenModels>;

export const zSettings = z
	.object({
		instructions: z.array(z.string()),
		embeddingConfig: zConfig,
		useEmbeddingSearch: z.boolean(),
		preferredWebProvider: z.string(),
		hiddenModels: zHiddenModels,
		useProviderCache: z.boolean(),
		useBrowserModels: z.boolean(),
		theme: z.string(),
		codeTheme: z.string(),
		blackout: z.boolean(),
		providers: zProviderSettings,
		mcpServers: zMCPServers.catch(() => undefined),
		presets: z.record(z.string(), zConfig),
	})
	.partial();
export type zSettings = z.infer<typeof zSettings>;

export const zUser = z.object({
	id: z.string(),
	name: z.string().default(CommonUtils.defaultName),
	settings: zSettings,
	isEphemeral: z.boolean(),
});
export type zUser = z.infer<typeof zUser>;
