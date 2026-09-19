import type { zProviderEnv } from "../../../core/types/env.ts";
import type { zConfig } from "../../data/types/message.ts";
import type { zUser } from "../../data/types/user.ts";
import { ModelProviderService } from "../services/ModelProviderService.ts";
import type { ModelProvider } from "../types/model.ts";

export type EmbeddingBatch = {
	messages: { id: string; text: string; total?: string | number }[];
	actions: { id: string; text: string; total?: string | number }[];
	memories: { id: string; text: string; total?: string | number }[];
	files: { id: string; text: string; total?: string | number }[];
};

export type EmbeddingBatchItem = {
	type: "message" | "action" | "memory" | "file";
	id: string;
	text: string;
};

export type EmbeddingBatchResult = {
	type: EmbeddingBatchItem["type"];
	id: string;
	embedding: number[];
};

export type EmbeddingBatchStatus = {
	batch: EmbeddingBatch | null;
	batchCount: number;
	totalCount: number;
};

/**
 * Shared embedding-batch helpers used by the client hook and the server runner.
 */
export const EmbeddingUtils = {
	/** Matches the client's batch size so both sides drain at the same pace. */
	BATCH_LIMIT: 4,

	/**
	 * Providers registered on {@link ModelProviderService} can embed on the
	 * server. App-injected ones (WebLLM, AFM, …) are client-only.
	 */
	isServerProvider: (provider: string) =>
		ModelProviderService.providers.some((p) => p.name === provider),

	getServerProvider: (provider: string) =>
		ModelProviderService.providers.find((p) => p.name === provider),

	toInput: (batch: EmbeddingBatch): EmbeddingBatchItem[] => [
		...batch.messages.map((message) => ({
			type: "message" as const,
			id: message.id,
			text: message.text,
		})),
		...batch.actions.map((action) => ({
			type: "action" as const,
			id: action.id,
			text: action.text,
		})),
		...batch.memories.map((memory) => ({
			type: "memory" as const,
			id: memory.id,
			text: memory.text,
		})),
		...batch.files.map((file) => ({
			type: "file" as const,
			id: file.id,
			text: file.text,
		})),
	],

	count: (batch: EmbeddingBatch | null | undefined): number => {
		if (!batch) return 0;
		return (
			batch.messages.length +
			batch.actions.length +
			batch.memories.length +
			batch.files.length
		);
	},

	getStatus: (
		batch: EmbeddingBatch | null | undefined,
	): EmbeddingBatchStatus => ({
		batch: batch ?? null,
		batchCount: EmbeddingUtils.count(batch),
		totalCount:
			Number(batch?.messages[0]?.total ?? 0) +
			Number(batch?.actions[0]?.total ?? 0) +
			Number(batch?.memories[0]?.total ?? 0) +
			Number(batch?.files[0]?.total ?? 0),
	}),

	runBatch: async ({
		user,
		provider,
		config,
		env,
		batch,
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		config: zConfig;
		env: Partial<zProviderEnv>;
		batch: EmbeddingBatch;
	}): Promise<EmbeddingBatchResult[]> => {
		const input = EmbeddingUtils.toInput(batch);
		if (input.length === 0) return [];

		const result = await ModelProviderService.runEmbeddingModel({
			user,
			provider,
			values: input.map((item) => item.text),
			config,
			env,
		});

		return input.map(({ text: _, ...rest }, index) => ({
			...rest,
			embedding: result[index],
		}));
	},
} as const;
