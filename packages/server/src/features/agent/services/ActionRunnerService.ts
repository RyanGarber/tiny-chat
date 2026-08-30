import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import {
	Author,
	zConfig,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { MessageUtils } from "../../message/utils/MessageUtils.ts";
import { ServerAgentService } from "./ServerAgentService.ts";

let running = false;

export const ActionRunnerService = {
	next: async ({ testUserId }: { testUserId?: string } = {}) => {
		if (running) {
			console.warn(
				"[ActionRunnerService] ignoring action run because one is already running",
			);
			return;
		}

		running = true;

		try {
			const actions = await globalThis.db.orm.public.Action.include("user")
				.include("message", (m) => m.select("chatId"))
				.all();
			const now = new Date();

			for (const action of actions) {
				try {
					if (
						testUserId ? action.user.id !== testUserId : action.user.isEphemeral
					) {
						continue;
					}

					const nextRunAt = CommonUtils.getScheduled({
						rrule: action,
						after: CommonUtils.toDate(action.lastRanAt),
					});

					if ((!nextRunAt || nextRunAt > now) && testUserId !== action.userId) {
						continue;
					}
					console.log(
						`[ActionRunnerService] starting action ${action.id} scheduled for ${nextRunAt}`,
					);

					await globalThis.db.orm.public.Action.where({
						id: action.id,
						userId: action.userId,
					}).update({
						lastRanAt: Temporal.Instant.fromEpochMilliseconds(now.getTime())
							.toZonedDateTimeISO("UTC")
							.toPlainDateTime(),
					});
					const user = zUser.parse(action.user);
					const chat = await ChatService.getChat({
						user,
						chat: action.message.chatId,
					});
					const { messages } = await MessageService.getMessages({
						user,
						chat,
						start: action.messageId,
					});
					const { userMessage, modelMessage } = await globalThis.db.transaction(
						async (tx) => {
							const base = {
								userId: user.id,
								chatId: chat.id,
								config: zConfig.parse(action.config),
								metadata: [],
							};
							const userMessage = MessageUtils.toMessageState(
								await tx.orm.public.Message.create({
									...base,
									id: CommonUtils.getRandomId(),
									author: Author.USER,
									data: zData.parse(action.data),
									previousId: messages.at(-1)?.id ?? action.messageId,
								}),
							);
							const modelMessage = MessageUtils.toMessageState(
								await tx.orm.public.Message.create({
									...base,
									id: CommonUtils.getRandomId(),
									author: Author.MODEL,
									data: [],
									previousId: userMessage.id,
								}),
							);
							return { userMessage, modelMessage };
						},
					);

					const { data, metadata } = await ServerAgentService.runAgent({
						chat,
						context: {
							user,
							chat,
							messages: [...messages, userMessage, modelMessage],
							timezone: action.timezone,
							interactive: false,
						},
						prompt: userMessage,
					});

					await globalThis.db.orm.public.Message.where({
						id: modelMessage.id,
						userId: user.id,
					}).update({ data, metadata });

					console.log(
						`[ActionRunnerService] action complete:`,
						action,
						userMessage,
						modelMessage,
					);
				} catch (error) {
					console.error(
						`[ActionRunnerService] error running action ${action.id}:`,
						error,
					);
				}
			}
		} finally {
			running = false;
		}
	},
} as const;
