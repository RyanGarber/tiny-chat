import { useMutation, useQuery } from "@tanstack/react-query";
import { EmbeddingUtils } from "@tiny-chat/core/src/features/provider/utils/EmbeddingUtils.ts";
import { useContext, useEffect, useMemo, useRef } from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { ClientProviderService } from "../../agent/services/ClientProviderService.ts";
import { useEmbeddingSettings } from "../../settings/hooks/useEmbeddingSettings.ts";

export type EmbeddingStatus = ReturnType<typeof EmbeddingUtils.getStatus>;

export const nextEmbeddingBatchQueryKey = ["embedding", "next"] as const;
export const runEmbeddingBatchMutationKey = ["embedding", "run"] as const;

export const useEmbedding = () => {
	const client = useContext(ClientContext);
	const { session } = useSession();
	const { embeddingConfig } = useEmbeddingSettings();

	const serverHandlesHydration =
		!!embeddingConfig &&
		EmbeddingUtils.isServerProvider(embeddingConfig.provider);

	const nextEmbeddingBatch = useQuery({
		queryKey: [
			...nextEmbeddingBatchQueryKey,
			session.data?.user.id,
			embeddingConfig?.provider,
			embeddingConfig?.model,
		],
		queryFn: async () => {
			if (!session.data || !embeddingConfig) return null;

			const missing = await client.api.embedding.getMissingEmbeddings.query({
				limit: EmbeddingUtils.BATCH_LIMIT,
			});
			const total = EmbeddingUtils.count(missing);
			if (total === 0) {
				console.log("[useEmbedding] no missing embeddings");
				return null;
			}

			console.log("[useEmbedding] incoming batch:", missing);

			return missing;
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		// Server runner drains the backlog; poll so the status UI stays current.
		refetchInterval: serverHandlesHydration ? 2000 : false,
	});

	const runEmbeddingBatch = useMutation({
		mutationKey: runEmbeddingBatchMutationKey,
		mutationFn: async (
			batch: Awaited<
				ReturnType<typeof client.api.embedding.getMissingEmbeddings.query>
			>,
		) => {
			if (!session.data || !embeddingConfig) return;

			console.log("[useEmbedding] starting batch:", batch);

			const modelProviders = await ClientProviderService.getModelProviders({
				client,
				user: session.data.user,
			});

			const modelProvider = modelProviders.find(
				(p) => embeddingConfig && p.name === embeddingConfig.provider,
			);

			if (!modelProvider)
				throw new Error(`provider "${embeddingConfig.provider}" not found`);

			const output = await EmbeddingUtils.runBatch({
				user: session.data.user,
				provider: modelProvider,
				config: embeddingConfig,
				env: client.providerEnv,
				batch,
			});
			console.log("[useEmbedding] saving embeddings:", output);

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
		// Server-capable providers are hydrated by EmbeddingRunnerService.
		if (serverHandlesHydration) return;

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
	}, [
		serverHandlesHydration,
		nextEmbeddingBatch.data,
		nextEmbeddingBatch.isFetching,
		client.queryClient.getMutationCache,
	]);

	const embeddingStatus = useMemo<EmbeddingStatus>(
		() => EmbeddingUtils.getStatus(nextEmbeddingBatch.data),
		[nextEmbeddingBatch.data],
	);

	return { embeddingStatus, nextEmbeddingBatch, runEmbeddingBatch };
};
