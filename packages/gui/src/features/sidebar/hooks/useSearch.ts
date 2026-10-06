import { useDebouncedValue } from "@mantine/hooks";
import type { SpotlightActionData } from "@mantine/spotlight";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useContext, useRef } from "react";
import { ClientContext } from "#client/client.ts";
import { useSession } from "#client/core/hooks/useSession.ts";
import { ClientProviderService } from "#client/features/agent/services/ClientProviderService.ts";
import { useOpenMessage } from "#client/features/chat/hooks/useOpenMessage.ts";
import { useEmbeddingSettings } from "#client/features/settings/hooks/useEmbeddingSettings.ts";
import { SnippetService } from "#core/features/data/services/SnippetService.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";

export const useSearch = ({
	query = "",
	onSelect,
}: {
	query: string;
	onSelect: () => void;
}) => {
	const client = useContext(ClientContext);
	const { openMessage } = useOpenMessage();

	const { session } = useSession();
	const { embeddingConfig, useEmbeddingSearch } = useEmbeddingSettings();

	const [debouncedQuery] = useDebouncedValue(query, 500);
	const embeddingCache = useRef<Map<string, number[]>>(new Map());

	const debouncedSearch = useQuery({
		queryKey: ["Sidebar", "debouncedSearch", debouncedQuery],
		queryFn: async () => {
			if (debouncedQuery.trim().length < 3) {
				return null;
			}

			if (!embeddingConfig || !useEmbeddingSearch) {
				return { text: debouncedQuery, embedding: undefined };
			}

			if (!session.data) return { text: debouncedQuery, embedding: undefined };
			const provider = (
				await ClientProviderService.getModelProviders({
					client,
					user: session.data.user,
				})
			).find((provider) => provider.name === embeddingConfig?.provider);
			if (!provider) return { text: debouncedQuery, embedding: undefined };

			if (!embeddingCache.current.has(debouncedQuery)) {
				const embedding = await ModelProviderService.runEmbeddingModel({
					user: session.data.user,
					provider,
					values: [debouncedQuery],
					config: embeddingConfig,
					env: client.providerEnv,
				});
				embeddingCache.current.set(debouncedQuery, embedding[0]);
			}

			return {
				text: debouncedQuery,
				embedding: embeddingCache.current.get(debouncedQuery),
			};
		},
		enabled: debouncedQuery.trim().length >= 3,
	});

	const spotlightActions = useInfiniteQuery({
		...client.query.chat.searchChats.infiniteQueryOptions(
			{
				searchText: debouncedSearch?.data?.text ?? "",
				searchEmbedding: debouncedSearch?.data?.embedding,
				limit: 5,
			},
			{
				enabled: debouncedQuery.trim().length >= 3,
				getNextPageParam: (lastPage) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages.map((page) => ({
							...page,
							results: page.results.map(
								(result): SpotlightActionData => ({
									id: result.id,
									label: result.chatTitle
										? DataUtils.getTextCleaned({
												data: result.chatTitle,
												maxLength: 50,
											})
										: undefined,
									description: SnippetService.getSnippet({
										text: DataUtils.getTextCleaned(result),
										query: debouncedQuery,
									}),
									onClick: () => {
										openMessage.mutate(result.id);
										onSelect();
									},
									group: result.chatTitle ?? undefined,
								}),
							),
						})),
						pageParams: data.pageParams,
					};
				},
			},
		),
	});

	return { actions: spotlightActions };
};
