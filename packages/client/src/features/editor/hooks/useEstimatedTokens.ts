import { useQuery } from "@tanstack/react-query";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import {
	AgentTokensService,
	type TokenBreakdown,
} from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import type { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { useCapabilities } from "../../capability/hooks/useCapabilities.ts";
import { useChat } from "../../chat/hooks/useChat.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";

export type UsageLevel = "low" | "moderate" | "high";

export const chatTokensQueryKey = [
	"useEstimatedTokens",
	"estimatedTokens",
] as const;

export const editorTokensQueryKey = ["useEstimatedTokens", "editorTokens"];

export const useEstimatedTokens = <T>({
	data,
	colors,
}: {
	data: zData;
	colors?: Partial<Record<UsageLevel, T>>;
}) => {
	const { session } = useSession();
	const { chat } = useChat();
	const { config } = useConfig();
	const { toolsets } = useTools();
	const { skills } = useSkills();
	const { presumedCapabilities, sourceMessages } = useCapabilities({
		future: false,
	});

	const createIncognito = useChatStore((state) => state.createIncognito);
	const [debouncedData, setDebouncedData] = useState(data);
	const debouncedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debouncedTimeout.current) {
			clearTimeout(debouncedTimeout.current);
		}
		debouncedTimeout.current = setTimeout(() => {
			setDebouncedData(data);
		}, 1000);
		return () => {
			if (debouncedTimeout.current) {
				clearTimeout(debouncedTimeout.current);
			}
		};
	}, [data]);

	const chatTokens = useQuery({
		queryKey: [
			...chatTokensQueryKey,
			session.data?.user.id,
			chat.data?.id,
			createIncognito,
			Object.entries(presumedCapabilities.data ?? {})
				.map(([key, value]) => `${key}:${!!value}`)
				.join(),
			sourceMessages.data,
		],
		queryFn: async (): Promise<TokenBreakdown> => {
			if (!session.data) return AgentTokensService.zero;

			return await AgentService.estimate({
				context: {
					user: session.data.user,
					chat: chat.data,
					messages: sourceMessages.data?.messages ?? [],
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
				capabilities: presumedCapabilities.data ?? {},
				toolsets,
				skills,
			});
		},
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const dataTokens = useQuery({
		queryKey: [...editorTokensQueryKey, debouncedData],
		queryFn: async () => {
			if (!session.data) return AgentTokensService.zero;

			return await AgentService.estimate({
				context: {
					user: session.data.user,
					chat: chat.data,
					messages: [
						{
							id: null,
							author: "USER",
							config,
							data: debouncedData,
							createdAt: new Date(),
						},
					],
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
				capabilities: presumedCapabilities.data ?? {},
				toolsets,
				skills,
				skipInstructions: true,
			});
		},
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const { totalTokens, totalUsage } = useMemo(() => {
		const totalTokens =
			(chatTokens.data?.total ?? 0) + (dataTokens.data?.total ?? 0);
		const maxTokens =
			config.args?.["tokens-in"] !== undefined
				? Number(config.args["tokens-in"])
				: undefined;
		const percent =
			maxTokens !== undefined ? (totalTokens / maxTokens) * 100 : 0;
		let level: UsageLevel = "low";
		if (percent >= 75) level = "moderate";
		if (percent >= 100) level = "high";
		const color = colors?.[level] ?? "";
		const loading = chatTokens.isFetching || dataTokens.isFetching;
		return { totalTokens, totalUsage: { percent, level, color, loading } };
	}, [
		chatTokens.data,
		dataTokens.data,
		chatTokens.isFetching,
		dataTokens.isFetching,
		config.args["tokens-in"],
		colors,
	]);

	const categories = useMemo<
		{ name: string; tokens: number; loading: boolean }[]
	>(
		() => [
			{
				name: "Instructions",
				tokens: chatTokens.data?.instructions ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Memories",
				tokens: chatTokens.data?.memories ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Thoughts",
				tokens: chatTokens.data?.thoughts ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Tools",
				tokens: chatTokens.data?.tools ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Text",
				tokens: (chatTokens.data?.text ?? 0) + (dataTokens.data?.text ?? 0),
				loading: chatTokens.isFetching || dataTokens.isFetching,
			},
			{
				name: "Files",
				tokens: (chatTokens.data?.files ?? 0) + (dataTokens.data?.files ?? 0),
				loading: chatTokens.isFetching || dataTokens.isFetching,
			},
		],
		[
			chatTokens.data?.files,
			chatTokens.data?.instructions,
			chatTokens.data?.memories,
			chatTokens.data?.text,
			chatTokens.data?.thoughts,
			chatTokens.data?.tools,
			chatTokens.isFetching,
			dataTokens.data?.files,
			dataTokens.data?.text,
			dataTokens.isFetching,
		],
	);

	return { totalTokens, totalUsage, categories };
};
