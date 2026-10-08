import { useMutation } from "@tanstack/react-query";
import { useContext, useRef } from "react";
import { ClientContext } from "#client/client.ts";
import { useSession } from "#client/core/hooks/useSession.ts";
import { useConfig } from "#client/features/agent/hooks/useConfig.ts";
import { useProviders } from "#client/features/agent/hooks/useProviders.ts";
import { useSkills } from "#client/features/agent/hooks/useSkills.ts";
import { useTools } from "#client/features/agent/hooks/useTools.ts";
import { ClientMessageService } from "#client/features/agent/services/ClientMessageService.ts";
import { ClientProviderService } from "#client/features/agent/services/ClientProviderService.ts";
import { useStreamStore } from "#client/features/agent/stores/useStreamStore.ts";
import { useChat } from "#client/features/chat/hooks/useChat.ts";
import { ChatService } from "#client/features/chat/services/ChatService.ts";
import { MessagingService } from "#client/features/chat/services/MessagingService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessageQueueStore } from "#client/features/chat/stores/useMessageQueueStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import { MessageQueryService } from "#client/features/message/services/MessageQueryService.ts";
import { ToolFeedbackService } from "#client/features/part/services/ToolFeedbackService.ts";
import { useEmbeddingSettings } from "#client/features/settings/hooks/useEmbeddingSettings.ts";
import type { ChatState } from "#core/features/data/types/chat.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zData, zToolCallPart } from "#core/features/data/types/part.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";
import { ToolCallUtils } from "#core/features/tool/utils/ToolCallUtils.ts";

export const deleteMessageMutationKey = [
	"useMessaging",
	"deleteMessage",
] as const;
export const sendMessageMutationKey = ["useMessaging", "sendMessage"] as const;
export const sendToolInputMutationKey = [
	"useMessaging",
	"sendToolFeedback",
] as const;

/** Resolves once no generation is running in the chat. */
const idle = (chatId: string) =>
	new Promise<void>((resolve) => {
		if (!useStreamStore.getState().chatAgentStreams.has(chatId)) {
			resolve();
			return;
		}
		const unsubscribe = useStreamStore.subscribe((state) => {
			if (state.chatAgentStreams.has(chatId)) return;
			unsubscribe();
			resolve();
		});
	});

export const useMessaging = () => {
	const client = useContext(ClientContext);

	const { chat } = useChat();
	const { session } = useSession();
	const { mcpTools } = useTools();
	const { skills } = useSkills();
	const { providers } = useProviders();
	const { embeddingConfig } = useEmbeddingSettings();
	const { config, status: configStatus } = useConfig();

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
			const { truncating, editing, insertingAfter, project } =
				useMessagingStore.getState();
			const { createTemporary, createIncognito } = useChatStore.getState();

			const data = MessagingService.getData({ client });
			const isEmpty = !data
				.flat()
				.some((part) => part.type !== "text" || part.value.trim().length);
			// Kept as a draft until there is a model to send it to.
			if (isEmpty || configStatus !== "ready") {
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
									await MessageQueryService.ensure(
										client,
										selectedId,
										useChatStore.getState().branches,
									)
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
							await MessageQueryService.ensure(client, chatId, branches)
						).messages.at(-1)?.id
					: undefined);
			const message = editing
				? await client.api.message.editMessage.mutate({
						message: editing.id,
						author: editing.author,
						config: config,
						data: data,
						truncate: truncating ?? false,
					})
				: await client.api.message.createMessage.mutate({
						chat: chatId,
						projectId: chatId ? undefined : project?.id,
						author: "USER",
						config: config,
						data: data,
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
			const answer = { approved, feedback };

			// A generation still running takes the answer as it goes.
			if (ToolFeedbackService.give(part.id, answer)) return;

			if (!session.data || !chat.data || !providers.data) return;

			// One that is just ending does not, and the answer resumes the message
			// it leaves behind rather than racing it.
			await idle(seed.chatId);

			if (part.validation?.approval && !approved) {
				await ClientMessageService.onMessage({
					client,
					user: session.data.user,
					message: seed,
					chat: chat.data,
					toolResults: [
						{
							type: "toolResult",
							id: part.id,
							name: part.name,
							error: true,
							output: ToolCallUtils.getRejection(),
						},
					],
					providers: providers.data,
					skills,
					mcpTools: mcpTools.data ?? [],
				});
				return;
			}

			// The generation it resumes runs it, and takes any other answers while
			// it does.
			ToolFeedbackService.hold(part.id, answer);
			try {
				await ClientMessageService.onMessage({
					client,
					user: session.data.user,
					message: seed,
					chat: chat.data,
					providers: providers.data,
					skills,
					mcpTools: mcpTools.data ?? [],
					toolResults: [],
					answered: true,
				});
			} catch (error) {
				ToolFeedbackService.settle(part.id);
				throw error;
			}
		},
	});

	return { deleteMessage, sendMessage, sendToolFeedback };
};
