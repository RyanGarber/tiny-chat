import { useDebouncedValue } from "@mantine/hooks";
import type { SpotlightActionData } from "@mantine/spotlight";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSession } from "@tiny-chat/client/src/core/hooks/useSession.ts";
import { ClientProviderService } from "@tiny-chat/client/src/features/agent/services/ClientProviderService.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useEmbeddingSettings } from "@tiny-chat/client/src/features/settings/hooks/useEmbeddingSettings.ts";
import { SnippetService } from "@tiny-chat/core/src/features/data/services/SnippetService.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { useRef } from "react";
import { client } from "#app/client.ts";

export const useSearch = ({
	query = "",
	onSelect,
}: {
	query: string;
	onSelect: () => void;
}) => {
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
				searchText: debouncedSearch?.data?.text,
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
										ChatService.setChat({ id: result.chatId });
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
