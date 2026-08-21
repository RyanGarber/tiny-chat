import { useMutation } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
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
import { ClientAgentService } from "../../agent/services/ClientAgentService.ts";
import { ClientMessageService } from "../../agent/services/ClientMessageService.ts";
import { ClientProviderService } from "../../agent/services/ClientProviderService.ts";
import { useEmbeddingSettings } from "../../settings/hooks/useEmbeddingSettings.ts";
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

			if (!session.data) throw new Error("missing session");

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
				(!editing || text.trim() !== DataUtils.getText(editing).trim()) &&
				embeddingConfig
			) {
				const provider = (
					await ClientProviderService.getModelProviders({
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

			let chatData: ChatState;
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
				chatData = await client.api.chat.getChat.query(message);
			} else {
				void ChatService.fetchMessages({ client, chatId: message.chatId });
				chatData = chat.data ?? (await client.api.chat.getChat.query(message));
			}

			if (!providers.data || !session.data) {
				throw new Error("missing provider or session data");
			}

			await ClientMessageService.onMessage({
				client,
				user: session.data.user,
				message,
				chat: chatData,
				providers: providers.data,
				skills,
				mcpTools: mcpTools.data ?? [],
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

		throwOnError: true,
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
			console.log(
				"[useMessaging] applying tool feedback:",
				part,
				value,
				approved,
			);
			if (!session.data || !chat.data || !providers.data) return;
			const { messages } = await client.api.message.getMessages.query({
				chat: chat.data,
			});
			const message = messages.at(-1);
			if (!message) throw new Error("missing message");

			const { tool } = ToolUtils.find({ toolsets, part });
			if (!tool) throw new Error(`tool ${part.name} not found`);

			if (append && !Array.isArray(append)) append = [append];
			if (!append?.length) append = null;

			let result: zDataPart;

			if (part.validation?.approval && !approved) {
				result = {
					type: "toolResult",
					id: part.id,
					name: part.name,
					error: true,
					value: ToolCallUtils.rejection,
					append: append ?? undefined,
				};
			} else {
				result = {
					...(await ClientAgentService.runTool({
						client,
						user: session.data.user,
						chat: chat.data,
						part,
						value,
						message: seed,
						messages,
						skills,
						mcpTools: mcpTools.data ?? [],
						interactive: true,
					})),
					append: append ?? undefined,
				};
			}

			await ClientMessageService.onMessage({
				client,
				user: session.data.user,
				message: seed,
				chat: chat.data,
				append: [result],
				providers: providers.data,
				skills,
				mcpTools: mcpTools.data ?? [],
			});
		},
	});

	return { deleteMessage, sendMessage, sendToolFeedback };
};
