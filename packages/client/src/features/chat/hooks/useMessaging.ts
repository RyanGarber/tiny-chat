import { useMutation } from "@tanstack/react-query";
import {
	Author,
	type MessageState,
	type zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { useContext, useRef } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { AgentMessageService } from "../../agent/services/AgentMessageService.ts";
import { ProviderService } from "../../agent/services/ProviderService.ts";
import { useEmbeddingSettings } from "../../settings/hooks/useEmbeddingSettings.ts";
import { ChatService } from "../services/ChatService.ts";
import { MessagingService } from "../services/MessagingService.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { useMessagingStore } from "../stores/useMessagingStore.ts";

export const sendMessageMutationKey = ["send-message"] as const;
export const deleteMessageMutationKey = ["delete-message"] as const;

export const useMessaging = () => {
	const client = useContext(ClientProvider);

	const { session } = useSession();
	const { mcpTools } = useTools();
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
				if (!session.data || !embeddingConfig.data) return;

				const provider = (
					await ProviderService.getModelProviders({
						client,
						user: session.data.user,
					})
				).find((p) => p.name === embeddingConfig.data?.provider);

				if (provider) {
					console.log(`[messaging] message changed, embedding new message`);
					const embeddings = await ModelProviderService.runEmbeddingModel({
						user: session.data.user,
						provider,
						values: [text],
						config: embeddingConfig.data,
						env: client.providerEnv,
					});
					if (embeddings[0]?.length) {
						await client.api.embedding.setEmbeddings.mutate([
							{ type: "message", id: message.id, embedding: embeddings[0] },
						]);
						console.log(`[messaging] embedded succeeded`);
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

	return { sendMessage, deleteMessage };
};
