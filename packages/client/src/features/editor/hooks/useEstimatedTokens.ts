import { useQuery } from "@tanstack/react-query";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import {
	AgentTokensService,
	type CompactionResult,
} from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import type { zData } from "@tiny-chat/core/src/features/data/types/part.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCapabilities } from "../../../core/hooks/useCapabilities.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useStableKey } from "../../../core/hooks/useStableKey.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { useChat } from "../../chat/hooks/useChat.ts";

export type UsageLevel = "low" | "moderate" | "high";

export type Categories = { name: string; tokens: number; loading: boolean }[];

export type Usage<T> = {
	percent: number;
	level: UsageLevel;
	color: T;
	loading: boolean;
};

const ZERO: CompactionResult = {
	before: AgentTokensService.zero,
	compaction: new Map(),
	after: AgentTokensService.zero,
	messages: [],
};

export const chatTokensQueryKey = [
	"useEstimatedTokens",
	"estimatedTokens",
] as const;

export const editorTokensQueryKey = ["useEstimatedTokens", "editorTokens"];

export const useEstimatedTokens = <T>({
	draft,
	colors,
}: {
	draft: zData;
	colors?: Partial<Record<UsageLevel, T>>;
}) => {
	const { session } = useSession();
	const { nextChat } = useChat();
	const { config: baseConfig, modelArgs } = useConfig();
	const { toolsets } = useTools();
	const { skills } = useSkills();

	const config = useMemo(() => {
		return {
			...baseConfig,
			args: {
				...baseConfig.args,
				"tokens-in":
					baseConfig.args["tokens-in"] ??
					modelArgs.find((arg) => arg.name === "tokens-in")?.default,
			},
		};
	}, [baseConfig, modelArgs]);

	const [debouncedDraft, setDebouncedDraft] = useState(draft);
	const debouncedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debouncedTimeout.current) {
			clearTimeout(debouncedTimeout.current);
		}
		debouncedTimeout.current = setTimeout(() => {
			setDebouncedDraft(draft);
		}, 1000);
		return () => {
			if (debouncedTimeout.current) {
				clearTimeout(debouncedTimeout.current);
			}
		};
	}, [draft]);

	/**
	 * The message being written, counted as a message. Its attachments are read
	 * off the mount like any other, which is what lets an upload attached here
	 * cost what it will cost before it is sent.
	 */
	const draftMessage = useMemo(
		(): zAgentMessage[] => [
			{
				id: null,
				author: "USER",
				config,
				// TODO: empty data gets dropped, preventing token count, so we add a '.' here
				//       this won't meaningfully change the result but should be fixed another way eventually
				data: [
					[{ id: CommonUtils.getRandomId(), type: "text", value: "." }],
					...debouncedDraft,
				],
				createdAt: Temporal.Now.plainDateTimeISO("UTC"),
			},
		],
		[config, debouncedDraft],
	);

	const { capabilities, sourceMessages } = useCapabilities({
		future: false,
		draft: draftMessage,
	});

	const messagesKey = useStableKey({
		messages: sourceMessages.data?.messages,
		toolsets,
	});
	const messagesEmpty = useMemo(() => {
		return !sourceMessages.data?.messages.length;
	}, [sourceMessages]);

	const chatTokens = useQuery({
		queryKey: [
			...chatTokensQueryKey,
			session.data?.user.id,
			capabilities.data,
			nextChat,
			messagesKey,
			config,
		],
		queryFn: async (): Promise<CompactionResult> => {
			if (!session.data) return ZERO;

			return await AgentService.estimate({
				context: {
					user: session.data.user,
					chat: nextChat,
					messages: sourceMessages.data?.messages ?? [],
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					interactive: true,
				},
				config,
				capabilities: capabilities.data ?? {},
				toolsets,
				skills,
			});
		},
		throwOnError: true,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const draftKey = useStableKey({ messages: draftMessage, toolsets });

	const draftTokens = useQuery({
		queryKey: [
			...editorTokensQueryKey,
			session.data?.user.id,
			capabilities.data,
			nextChat,
			config,
			draftKey,
			messagesEmpty,
		],
		queryFn: async (): Promise<CompactionResult> => {
			if (!session.data) return ZERO;

			return await AgentService.estimate({
				context: {
					user: session.data.user,
					chat: nextChat,
					messages: draftMessage,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					interactive: true,
				},
				config,
				capabilities: capabilities.data ?? {},
				toolsets,
				skills,
			});
		},
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const { totalTokens, usage } = useMemo<{
		totalTokens: number;
		usage: Usage<T>;
	}>(() => {
		const totalTokens =
			(chatTokens.data?.before.total ?? 0) +
			(draftTokens.data?.before.total ?? 0);
		const maxTokens =
			config.args?.["tokens-in"] !== undefined
				? Number(config.args["tokens-in"])
				: undefined;
		const percent =
			maxTokens !== undefined ? (totalTokens / maxTokens) * 100 : 0;
		let level: UsageLevel = "low";
		if (percent >= 75) level = "moderate";
		if (percent >= 100) level = "high";
		const color = colors?.[level] ?? ("" as T);
		const loading = chatTokens.isFetching || draftTokens.isFetching;
		return { totalTokens, usage: { percent, level, color, loading } };
	}, [
		chatTokens.data,
		draftTokens.data,
		chatTokens.isFetching,
		draftTokens.isFetching,
		config.args["tokens-in"],
		colors,
	]);

	const categories = useMemo<Categories>(
		() => [
			{
				name: "Instructions",
				tokens: Math.max(
					chatTokens.data?.before.instructions ?? 0,
					draftTokens.data?.before.instructions ?? 0,
				),
				loading: chatTokens.isFetching || draftTokens.isFetching,
			},
			{
				name: "Memories",
				tokens: Math.max(
					chatTokens.data?.before.memories ?? 0,
					draftTokens.data?.before.memories ?? 0,
				),
				loading: chatTokens.isFetching || draftTokens.isFetching,
			},
			{
				name: "Thoughts",
				tokens: chatTokens.data?.before.thoughts ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Tools",
				tokens: chatTokens.data?.before.tools ?? 0,
				loading: chatTokens.isFetching,
			},
			{
				name: "Text",
				tokens:
					(chatTokens.data?.before.text ?? 0) +
					(draftTokens.data?.before.text ?? 0),
				loading: chatTokens.isFetching || draftTokens.isFetching,
			},
			{
				name: "Files",
				tokens:
					(chatTokens.data?.before.files ?? 0) +
					(draftTokens.data?.before.files ?? 0),
				loading: chatTokens.isFetching || draftTokens.isFetching,
			},
		],
		[
			chatTokens.data?.before.files,
			chatTokens.data?.before.instructions,
			chatTokens.data?.before.memories,
			chatTokens.data?.before.text,
			chatTokens.data?.before.thoughts,
			chatTokens.data?.before.tools,
			chatTokens.isFetching,
			draftTokens.data?.before.instructions,
			draftTokens.data?.before.memories,
			draftTokens.data?.before.files,
			draftTokens.data?.before.text,
			draftTokens.isFetching,
		],
	);

	return { chatTokens, draftTokens, totalTokens, usage, categories };
};
