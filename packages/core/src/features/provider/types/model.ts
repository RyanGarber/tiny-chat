import type { ProviderV3, ProviderV4 } from "@ai-sdk/provider";
import type { EmbeddingModel, LanguageModel, TextStreamPart } from "ai";
import { z } from "zod";
import type { zProviderEnv } from "../../../core/types/env.ts";
import {
	Author,
	type zConfig,
	zData,
	type zDataPart,
	type zSignature,
} from "../../data/types/message.ts";
import type { zUser } from "../../data/types/user.ts";
import type { Provider, ProviderStatus } from "./provider.ts";

export const zModelFeature = z.enum([
	"language",
	"language:tools",
	"embedding",
]);
export type zModelFeature = z.infer<typeof zModelFeature>;

export const zModelArg = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("list"),
		name: z.string(),
		values: z.array(z.string()),
		default: z.string(),
	}),
	z.object({
		type: z.literal("range"),
		name: z.string(),
		min: z.number(),
		max: z.number(),
		default: z.number(),
	}),
]);
export type zModelArg = z.infer<typeof zModelArg>;

export const zModel = z.object({
	name: z.string(),
	features: z.array(zModelFeature),
	args: z.array(zModelArg),
});
export type zModel = z.infer<typeof zModel>;

export const zModelMessage = z.object({
	author: z.enum(Author),
	data: zData,
});
export type zModelMessage = z.infer<typeof zModelMessage>;

export interface ModelProviderStatus extends ProviderStatus {
	models: zModel[];
}

export interface ModelProvider<T extends ProviderV3 | ProviderV4>
	extends Provider<ModelProviderStatus> {
	type: "model";

	/**
	 * Get the SDK instance for the given user, model, and environment.
	 */
	getSdk: (args: {
		user: zUser;
		model: string;
		env: Partial<zProviderEnv>;
	}) => T | null;

	getSdkOptions: (args: {
		user: zUser;
		config: zConfig;
		env: Partial<zProviderEnv>;
	}) => Record<string, any> | undefined;

	getModelArgs: (args: { model: string }) => zModelArg[];

	getLanguageModel: (args: {
		user: zUser;
		model: string;
		env: Partial<zProviderEnv>;
	}) => LanguageModel | null;

	getEmbeddingModel: (args: {
		user: zUser;
		model: string;
		env: Partial<zProviderEnv>;
	}) => EmbeddingModel | null;

	getPartTransformed?: (args: {
		user: zUser;
		config: zConfig;
		part: zDataPart;
	}) => zDataPart[] | undefined;

	getPartSignature?: (args: {
		user: zUser;
		config: zConfig;
		event: TextStreamPart<any>;
	}) => zSignature | undefined;

	getPartSignatureReturn?: (args: {
		user: zUser;
		config: zConfig;
		part: zDataPart;
	}) => Record<string, any> | undefined;
}
