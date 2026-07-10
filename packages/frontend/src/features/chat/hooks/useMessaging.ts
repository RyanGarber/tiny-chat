import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { InputService } from "#frontend/features/chat/services/InputService.ts";
import { useMessagingStore } from "#frontend/features/chat/stores/useMessagingStore.tsx";
import { useConfig } from "#frontend/features/config/hooks/useConfig.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useTools } from "#frontend/features/config/hooks/useTools.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { refetchMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { GenerateService } from "#frontend/features/message/services/GenerateService.ts";
import { useRetrieval } from "#frontend/features/settings/hooks/useRetrieval.ts";
import { useSkills } from "#frontend/features/uploads/hooks/useSkills.ts";
import { auth, env, trpc } from "#frontend/utils/api.ts";
import { embed } from "#shared/services/chat/embed.ts";
import { Author, type MessageState, type zData } from "#shared/types/chat";
import { scrubText, texts } from "#shared/utils";
import { ChatService } from "../services/ChatService";
import { useChatStore } from "../stores/useChatStore";
import { refetchChatList } from "./useChatList";

export const sendMessageMutationKey = ["send-message"] as const;
export const deleteMessageMutationKey = ["delete-message"] as const;

export const useMessaging = () => {
	const session = auth.useSession();
	const { toolGroups } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();
	const { embeddingConfig } = useRetrieval();
	const { config } = useConfig();

	const deletingChatId = useRef<string | undefined>(undefined);

	const deleteMessage = useMutation({
		mutationKey: deleteMessageMutationKey,
		mutationFn: async (message: MessageState) => {
			deletingChatId.current = message.chatId;
			return await trpc.message.delete.mutate({ id: message.id });
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
				? await trpc.message.edit.mutate({
						id: editing.id,
						author: editing.author,
						config: config,
						data: data,
						metadata: [],
						truncate: truncating ?? false,
					})
				: await trpc.message.create.mutate({
						chatId,
						author: Author.USER,
						config: config,
						data: data,
						metadata: [],
						previousId: insertingAfter?.id,
						temporary: createTemporary,
						incognito: createIncognito,
					});

			const changed =
				!editing || texts(message.data).trim() !== texts(editing.data).trim();
			if (texts(message.data).trim().length && changed) {
				if (!session.data || !embeddingConfig.data) return;

				const provider = (
					await ProviderService.getChatProviders(session.data.user)
				).find((p) => p.name === embeddingConfig.data?.provider);

				if (provider) {
					console.log(`[messaging] message changed, embedding new message`);
					const embeddings = await embed(
						session.data.user,
						provider,
						[texts(message.data)],
						embeddingConfig.data,
						env,
					);
					if (embeddings[0]?.length) {
						await trpc.context.saveEmbeddings.mutate([
							{ messageId: message.id, embedding: embeddings[0] },
						]);
						console.log(
							`[messaging] embedding succeeded for message ${message.id}`,
						);
					}
				}
			}

			if (!chatId) {
				ChatService.setChatId(message.chatId);
				const title = scrubText(texts(data, " "), 100);
				void (async () => {
					await trpc.chat.edit.mutate({ id: message.chatId, title });
					await refetchChatList();
				})();
			} else {
				await refetchMessages(message.chatId);
			}

			const activeChat = await trpc.chat.find.query({ id: message.chatId });
			if (!activeChat) throw new Error("Failed to create message or chat");
			if (!providers.data) throw new Error("Failed to fetch providers");
			await GenerateService.handle({
				message,
				activeChat,
				tools: toolGroups,
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
