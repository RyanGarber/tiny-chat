import { useMutation } from "@tanstack/react-query";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type {
	zData,
	zDataPart,
	zToolCallPart,
} from "@tiny-chat/core/src/features/data/types/part.ts";
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
import { useStreamStore } from "../../agent/stores/useStreamStore.ts";
import { MessageQueryService } from "../../message/services/MessageQueryService.ts";
import { useEmbeddingSettings } from "../../settings/hooks/useEmbeddingSettings.ts";
import { ChatService } from "../services/ChatService.ts";
import { MessagingService } from "../services/MessagingService.ts";
import { useChatStore } from "../stores/useChatStore.ts";
import { useMessageQueueStore } from "../stores/useMessageQueueStore.ts";
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
			sendingData.current = undefined;
			const { truncating, editing, insertingAfter, activeFolder } =
				useMessagingStore.getState();
			const { createTemporary, createIncognito } = useChatStore.getState();

			const data = MessagingService.getData({ client });
			const isEmpty = !data
				.flat()
				.some((part) => part.type !== "text" || part.value.trim().length);
			if (isEmpty) {
				return;
			}

			if (!session.data) {
				throw new Error("missing session");
			}

			const selectedId = useChatStore.getState().chatId;
			if (
				selectedId &&
				(useMessageQueueStore.getState().active[selectedId] ||
					useStreamStore.getState().chatAgentStreams.has(selectedId) ||
					(chat.data?.id === selectedId &&
						DataUtils.isMissingToolResult({
							data:
								(
									await client.api.message.getMessages.query({
										chat: selectedId,
										branches: useChatStore.getState().branches,
										limit: 1,
									})
								).messages.at(-1)?.data ?? [],
						})))
			) {
				useMessageQueueStore.getState().enqueue(selectedId, data);
				MessagingService.reset({ client });
				return;
			}

			sendingData.current = {
				data: data,
				temporary: createTemporary,
				incognito: createIncognito,
			};

			MessagingService.reset({ client });
			useChatStore.setState({ createTemporary: false, createIncognito: false });

			const { chatId: selectedChatId, branches } = useChatStore.getState();
			const chatId = selectedChatId ?? undefined;
			const previous =
				insertingAfter?.id ??
				(!editing && chatId
					? (
							await client.api.message.getMessages.query({
								chat: chatId,
								branches,
								limit: 1,
							})
						).messages.at(-1)?.id
					: undefined);
			const message = editing
				? await client.api.message.editMessage.mutate({
						message: editing.id,
						author: editing.author,
						config: config,
						data: data,
						metadata: [],
						truncate: truncating ?? false,
					})
				: await client.api.message.createMessage.mutate({
						chat: chatId,
						folderId: chatId ? undefined : activeFolder?.id,
						author: "USER",
						config: config,
						data: data,
						metadata: [],
						previous,
						temporary: createTemporary,
						incognito: createIncognito,
					});

			if (editing && !truncating && chatId === useChatStore.getState().chatId) {
				await MessageQueryService.write(client, message);
				await MessageQueryService.selectBranch(
					client,
					message.previousId,
					message.id,
				);
			} else {
				await MessageQueryService.write(client, message, true);
			}

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
			feedback,
			approved,
		}: {
			seed: MessageState;
			part: zToolCallPart;
			feedback?: unknown;
			approved?: boolean;
		}) => {
			console.log(
				"[useMessaging] applying tool feedback:",
				part,
				feedback,
				approved,
			);
			if (!session.data || !chat.data || !providers.data) return;
			const { messages: branchMessages } =
				await client.api.message.getMessages.query({
					chat: chat.data,
					start: seed.id,
				});
			const messages = branchMessages.slice(
				0,
				branchMessages.findIndex((m) => m.id === seed.id) + 1,
			);
			const message = messages.at(-1);
			if (!message) throw new Error("missing message");

			const { tool } = ToolUtils.find({ toolsets, part });
			if (!tool) throw new Error(`tool ${part.name} not found`);

			let result: zDataPart;

			if (part.validation?.approval && !approved) {
				result = {
					type: "toolResult",
					id: part.id,
					name: part.name,
					error: true,
					output: ToolCallUtils.getRejection(),
				};
			} else {
				result = {
					...(await ClientAgentService.runTool({
						client,
						user: session.data.user,
						chat: chat.data,
						part,
						feedback,
						message: seed,
						messages,
						skills,
						mcpTools: mcpTools.data ?? [],
						interactive: true,
					})),
				};
			}

			await ClientMessageService.onMessage({
				client,
				user: session.data.user,
				message: seed,
				chat: chat.data,
				toolResults: [result],
				providers: providers.data,
				skills,
				mcpTools: mcpTools.data ?? [],
			});
		},
	});

	return { deleteMessage, sendMessage, sendToolFeedback };
};
