import { useMutation } from "@tanstack/react-query";
import {
	Author,
	type MessageState,
	type zData,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "@tiny-chat/shared/src/features/provider/services/ModelProviderService";
import { useRef } from "react";
import { InputService } from "#frontend/features/chat/services/InputService.ts";
import { useMessagingStore } from "#frontend/features/chat/stores/useMessagingStore.tsx";
import { useConfig } from "#frontend/features/config/hooks/useConfig.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { useSkills } from "#frontend/features/file/hooks/useSkills.ts";
import { refetchMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { MessageHandlerService } from "#frontend/features/message/services/MessageHandlerService.ts";
import { useRetrieval } from "#frontend/features/settings/hooks/useRetrieval.ts";
import { auth, env, trpc } from "#frontend/utils/api.ts";
import { ChatService } from "../services/ChatService";
import { useChatStore } from "../stores/useChatStore";
import { refetchChatList } from "./useChatList";

export const sendMessageMutationKey = ["send-message"] as const;
export const deleteMessageMutationKey = ["delete-message"] as const;

export const useMessaging = () => {
	const session = auth.useSession();
	const { mcpTools } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();
	const { embeddingConfig } = useRetrieval();
	const { config } = useConfig();

	const deletingChatId = useRef<string | undefined>(undefined);

	const deleteMessage = useMutation({
		mutationKey: deleteMessageMutationKey,
		mutationFn: async (message: MessageState) => {
			deletingChatId.current = message.chatId;
			return await trpc.message.deleteMessage.mutate(message);
		},
		onSuccess: async (chatDeleted, message) => {
			void refetchMessages(deletingChatId.current);
			if (chatDeleted) {
				await refetchChatList();
				if (deletingChatId.current === message.chatId)
					ChatService.setChatId(null);
			}
		},
	});

	const sendingData = useRef<
		{ data: zData; temporary: boolean; incognito: boolean } | undefined
	>(undefined);

	const sendMessage = useMutation({
		mutationKey: sendMessageMutationKey,
		mutationFn: async () => {
			const { truncating, editing, insertingAfter, reset } =
				useMessagingStore.getState();
			const { createTemporary, createIncognito } = useChatStore.getState();

			const data = InputService.getData();
			if (!data.length) return;

			sendingData.current = {
				data: data,
				temporary: createTemporary,
				incognito: createIncognito,
			};

			reset();
			useChatStore.setState({ createTemporary: false, createIncognito: false });

			const chatId = useChatStore.getState().chatId ?? undefined;
			const message = editing
				? await trpc.message.updateMessage.mutate({
						message: editing.id,
						author: editing.author,
						config: config,
						data: data,
						metadata: [],
						truncate: truncating ?? false,
					})
				: await trpc.message.createMessage.mutate({
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
					await ProviderService.getModelProviders(session.data.user)
				).find((p) => p.name === embeddingConfig.data?.provider);

				if (provider) {
					console.log(`[messaging] message changed, embedding new message`);
					const embeddings = await ModelProviderService.runEmbeddingModel({
						user: session.data.user,
						provider,
						values: [text],
						config: embeddingConfig.data,
						env,
					});
					if (embeddings[0]?.length) {
						await trpc.embedding.setEmbeddings.mutate([
							{ type: "message", id: message.id, embedding: embeddings[0] },
						]);
						console.log(`[messaging] embedded succeeded`);
					}
				}
			}

			if (!chatId) {
				ChatService.setChatId(message.chatId);
				const title = DataUtils.getTextCleaned({ data, maxLength: 100 });
				void (async () => {
					await trpc.chat.setChatTitle.mutate({ chat: message.chatId, title });
					await refetchChatList();
				})();
			} else {
				await refetchMessages(message.chatId);
			}

			const chat = await trpc.chat.getChat.query(message);
			if (!providers.data || !session.data)
				throw new Error("missing provider or session data");
			await MessageHandlerService.handle({
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
				InputService.setData([...sendingData.current.data]);
				useChatStore.setState({
					createTemporary: sendingData.current.temporary,
					createIncognito: sendingData.current.incognito,
				});
			}
		},
	});

	return { sendMessage, deleteMessage };
};
