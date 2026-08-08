import { useMutation } from "@tanstack/react-query";
import {
	Author,
	type MessageState,
	type zData,
	type zDataBasicPart,
	type zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useContext, useRef } from "react";
import { ClientContext } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { AgentMessageService } from "../../agent/services/AgentMessageService.ts";
import { AgentToolService } from "../../agent/services/AgentToolService.ts";
import { ProviderService } from "../../agent/services/ProviderService.ts";
import { useEmbeddingSettings } from "../../settings/hooks/useEmbeddingSettings.ts";
import { ToolStreamService } from "../../tool/services/ToolStreamService.ts";
import { ChatService } from "../services/ChatService.ts";
import { MessagingService } from "../services/MessagingService.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";
import { useChat } from "./useChat.ts";

export const deleteMessageMutationKey = [
	"useMessaging",
	"deleteMessage",
] as const;
export const sendMessageMutationKey = ["useMessaging", "sendMessage"] as const;
export const sendToolInputMutationKey = [
	"useMessaging",
	"sendToolFeedback",
] as const;

export const useMessaging = () => {
	const client = useContext(ClientContext);

	const { chat } = useChat();
	const { session } = useSession();
	const { mcpTools, toolsets } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();
	const { embeddingConfig } = useEmbeddingSettings();
	const { config } = useConfig();

	const deletingChatId = useRef<string | undefined>(undefined);

	const deleteMessage = useMutation({
		mutationKey: deleteMessageMutationKey,
		mutationFn: async (message: MessageState) => {
			deletingChatId.current = message.chatId;
			return await client.api.message.deleteMessage.mutate(message);
		},
		onSuccess: async (chatDeleted, message) => {
			if (!deletingChatId.current) return;
			void ChatService.fetchMessages({
				client,
				chatId: deletingChatId.current,
			});
			if (chatDeleted) {
				await ChatService.fetchChatList({ client });
				if (deletingChatId.current === message.chatId)
					ChatService.setChat({ id: null });
			}
		},
	});

	const sendingData = useRef<
		{ data: zData; temporary: boolean; incognito: boolean } | undefined
	>(undefined);

	const sendMessage = useMutation({
		mutationKey: sendMessageMutationKey,
		mutationFn: async () => {
			const { truncating, editing, insertingAfter } =
				useMessagingStore.getState();
			const { createTemporary, createIncognito } = useChatStore.getState();

			const data = MessagingService.getData({ client });
			if (!data.length || !data.some((step) => step.length)) return;

			sendingData.current = {
				data: data,
				temporary: createTemporary,
				incognito: createIncognito,
			};

			MessagingService.reset({ client });
			useChatStore.setState({ createTemporary: false, createIncognito: false });

			const chatId = useChatStore.getState().chatId ?? undefined;
			const message = editing
				? await client.api.message.updateMessage.mutate({
						message: editing.id,
						author: editing.author,
						config: config,
						data: data,
						metadata: [],
						truncate: truncating ?? false,
					})
				: await client.api.message.createMessage.mutate({
						chat: chatId,
						author: Author.USER,
						config: config,
						data: data,
						metadata: [],
						previous: insertingAfter?.id,
						temporary: createTemporary,
						incognito: createIncognito,
					});

			const text = DataUtils.getText(message);
			if (
				text.length &&
				(!editing || text.trim() !== DataUtils.getText(editing).trim())
			) {
				if (!session.data || !embeddingConfig) return;

				const provider = (
					await ProviderService.getModelProviders({
						client,
						user: session.data.user,
					})
				).find((p) => p.name === embeddingConfig?.provider);

				if (provider) {
					console.log(`[messaging] message changed, embedding new message`);
					const embeddings = await ModelProviderService.runEmbeddingModel({
						user: session.data.user,
						provider,
						values: [text],
						config: embeddingConfig,
						env: client.providerEnv,
					});
					if (embeddings[0]?.length) {
						await client.api.embedding.setEmbeddings.mutate([
							{ type: "message", id: message.id, embedding: embeddings[0] },
						]);
						console.log(`[messaging] embeddings succeeded`);
					}
				}
			}

			if (!chatId) {
				ChatService.setChat({ id: message.chatId });
				const title = DataUtils.getTextCleaned({ data, maxLength: 100 });
				void (async () => {
					await client.api.chat.setChatTitle.mutate({
						chat: message.chatId,
						title,
					});
					await ChatService.fetchChatList({ client });
				})();
			} else {
				await ChatService.fetchMessages({ client, chatId: message.chatId });
			}

			const chat = await client.api.chat.getChat.query(message);
			if (!providers.data || !session.data)
				throw new Error("missing provider or session data");
			await AgentMessageService.handle({
				client,
				user: session.data.user,
				message,
				chat,
				mcpTools: mcpTools.data,
				providers: providers.data,
				skills,
			});
		},

		onError: () => {
			if (sendingData.current) {
				MessagingService.setData({
					client,
					data: [...sendingData.current.data],
				});
				useChatStore.setState({
					createTemporary: sendingData.current.temporary,
					createIncognito: sendingData.current.incognito,
				});
			}
		},
	});

	const sendToolFeedback = useMutation({
		mutationKey: sendToolInputMutationKey,
		mutationFn: async ({
			seed,
			part,
			value,
			approved,
			append = [],
		}: {
			seed: MessageState;
			part: Extract<zDataPart, { type: "toolCall" }>;
			value?: unknown;
			approved?: boolean;
			append?: zDataBasicPart[] | zDataBasicPart | null;
		}) => {
			console.log("[useToolInput] applying input:", part, value, approved);
			if (!session.data || !chat.data || !providers.data) return;
			const { messages } = await client.api.message.getMessages.query({
				chat: chat.data,
			});
			const message = messages.at(-1);
			if (!message) throw new Error("missing message");

			const { tool } = ToolUtils.find({ toolsets, part });
			if (!tool) throw new Error(`tool ${part.name} not found`);

			if (append && !Array.isArray(append)) {
				append = [append];
			}
			if (!append?.length) append = null;

			// Output the tool reports while it runs is held here, so the feedback
			// UI can show it before there is a result to save.
			const streamKey = ToolStreamService.key({
				messageId: seed.id,
				partId: part.id,
			});

			let result: zDataPart;
			if (tool.approval && !approved) {
				result = {
					type: "toolResult",
					id: part.id,
					name: part.name,
					error: true,
					value: ToolCallUtils.rejection,
					append: append ?? undefined,
				};
			} else {
				try {
					ToolStreamService.start(streamKey);
					result = {
						type: "toolResult",
						id: part.id,
						name: part.name,
						error: false,
						value: await AgentToolService.handle({
							client,
							user: session.data.user,
							chat: chat.data,
							part,
							value,
							message: seed,
							messages,
							onOutput: (chunk) => ToolStreamService.push(streamKey, chunk),
						}),
						append: append ?? undefined,
					};
				} catch (e) {
					result = {
						type: "toolResult",
						id: part.id,
						name: part.name,
						error: true,
						value: [
							{
								type: "json",
								value: e instanceof Error ? e.message : JSON.stringify(e),
							},
						],
						append: append ?? undefined,
					};
				} finally {
					// The command is over, but its output has to stay on screen until
					// the result it produced has been saved.
					ToolStreamService.finish(streamKey);
				}
			}

			try {
				await AgentMessageService.handle({
					client,
					user: session.data.user,
					message: seed,
					chat: chat.data,
					append: [result],
					mcpTools: mcpTools.data,
					providers: providers.data,
					skills,
				});
			} finally {
				ToolStreamService.clear(streamKey);
			}
		},
	});

	return { deleteMessage, sendMessage, sendToolFeedback };
};
