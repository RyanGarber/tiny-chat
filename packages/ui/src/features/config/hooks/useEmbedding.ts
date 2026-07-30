import { useMutation, useQuery } from "@tanstack/react-query";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { useEffect, useRef } from "react";
import { client } from "#ui/client.ts";
import { ProviderService } from "#ui/features/config/services/ProviderService.ts";
import { useRetrieval } from "#ui/features/settings/hooks/useRetrieval.ts";

const nextEmbeddingBatchQueryKey = ["embedding", "next"] as const;
export const runEmbeddingBatchMutationKey = ["embedding", "run"] as const;

export const fetchNextEmbeddingBatch = async () => {
	await client.queryClient.invalidateQueries({
		queryKey: nextEmbeddingBatchQueryKey,
	});
};

export const useEmbedding = () => {
	const session = client.auth.useSession();
	const { embeddingConfig } = useRetrieval();

	const nextEmbeddingBatch = useQuery({
		queryKey: [...nextEmbeddingBatchQueryKey, session.data?.user?.id],
		queryFn: async () => {
			if (!session.data || !embeddingConfig.data) return null;

			const missing = await client.api.embedding.getMissingEmbeddings.query({
				limit: 4,
			});
			console.log("[useEmbedding] incoming batch:", missing);
			return missing;
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const runEmbeddingBatch = useMutation({
		mutationKey: runEmbeddingBatchMutationKey,
		mutationFn: async (
			batch: NonNullable<
				Awaited<
					ReturnType<typeof client.api.embedding.getMissingEmbeddings.query>
				>
			>,
		) => {
			if (!session.data || !embeddingConfig.data) return;

			const { messages, actions, memories, files } = batch;
			console.log("[useEmbedding] starting batch:", batch);

			const input = [
				...messages.map((message) => ({
					type: "message" as const,
					id: message.id,
					text: message.text,
				})),
				...actions.map((action) => ({
					type: "action" as const,
					id: action.id,
					text: action.text,
				})),
				...memories.map((memory) => ({
					type: "memory" as const,
					id: memory.id,
					text: memory.text,
				})),
				...files.map((file) => ({
					type: "file" as const,
					id: file.id,
					text: file.text,
				})),
			];

			const modelProviders = await ProviderService.getModelProviders(
				session.data.user,
			);
			const modelProvider = modelProviders.find(
				(p) => embeddingConfig.data && p.name === embeddingConfig.data.provider,
			);
			if (!modelProvider)
				throw new Error(
					`provider "${embeddingConfig.data.provider}" not found`,
				);

			const result = await ModelProviderService.runEmbeddingModel({
				user: session.data.user,
				provider: modelProvider,
				values: input.map((item) => item.text),
				config: embeddingConfig.data,
				env: client.providerEnv,
			});
			console.log("[useEmbedding] saving embeddings:", result);

			const output = input.map(({ text: _, ...rest }, index) => ({
				...rest,
				embedding: result[index],
			}));
			await client.api.embedding.setEmbeddings.mutate(output);
		},
		onSuccess: () => setTimeout(() => void nextEmbeddingBatch.refetch(), 2000),
		onError: (error) => {
			console.warn("[useEmbedding] failed to embed:", error);
			// Retry after a delay by refetching the batch — this re-triggers the effect
			// and the pending guard ensures only one attempt runs at a time.
			setTimeout(() => void nextEmbeddingBatch.refetch(), 5000);
		},
	});

	// Keep a stable ref so the effect closure never captures a stale `mutate`.
	const runRef = useRef(runEmbeddingBatch.mutate);
	useEffect(() => {
		runRef.current = runEmbeddingBatch.mutate;
	}, [runEmbeddingBatch.mutate]);

	// A ref-based guard prevents a second Strict Mode invocation of the effect
	// from firing a duplicate mutation before the first one is registered as pending.
	const isPendingRef = useRef(false);

	useEffect(() => {
		const hasPendingMutation =
			isPendingRef.current ||
			client.queryClient.getMutationCache().findAll({
				mutationKey: runEmbeddingBatchMutationKey,
				status: "pending",
			}).length > 0;

		if (
			nextEmbeddingBatch.data &&
			!nextEmbeddingBatch.isFetching &&
			!hasPendingMutation
		) {
			isPendingRef.current = true;
			runRef.current(nextEmbeddingBatch.data, {
				onSettled: () => {
					isPendingRef.current = false;
				},
			});
		}
	}, [nextEmbeddingBatch.data, nextEmbeddingBatch.isFetching]);

	return { nextEmbeddingBatch, runEmbeddingBatch };
};
