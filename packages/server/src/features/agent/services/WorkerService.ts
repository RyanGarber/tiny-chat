import { createId } from "@paralleldrive/cuid2";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
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

export const WorkerService = {
	next: async ({ testUserId }: { testUserId?: string }) => {
		if (running) {
			console.warn(
				"[WorkerService] ignoring worker run because one is already running",
			);
			return;
		}

		running = true;

		const actions = await globalThis.prisma.action.findMany({
			include: { user: true },
		});
		const now = new Date();

		for (const action of actions) {
			try {
				if (
					(action.user.isEphemeral && !testUserId) ||
					action.user.id !== testUserId
				) {
					continue;
				}

				const nextRunAt = CommonUtils.getScheduled({
					rrule: action,
					after: action.lastRanAt,
				});

				if ((!nextRunAt || nextRunAt > now) && testUserId !== action.userId) {
					continue;
				}
				console.log(
					`[WorkerService] starting action ${action.id} scheduled for ${nextRunAt}`,
				);

				await globalThis.prisma.action.update({
					where: { id: action.id },
					data: { lastRanAt: now },
				});

				const user = zUser.parse(
					await globalThis.prisma.user.findUniqueOrThrow({
						where: { id: action.userId },
					}),
				);
				const chat = await ChatService.getChat({ user, chat: action.chatId });
				const { messages } = await MessageService.getMessages({ user, chat });

				const userMessage = MessageUtils.toMessageState(
					await globalThis.prisma.message.create({
						data: {
							id: createId(),
							user: { connect: { id: action.userId } },
							folder: { connect: { id: action.folderId } },
							chat: { connect: { id: action.chatId } },
							config: zConfig.parse(action.config),
							author: Author.USER,
							data: zData.parse(action.data),
							metadata: [],
							previous: { connect: { id: messages[messages.length - 1]?.id } },
						},
					}),
				);

				const modelMessageId = createId();
				const modelMessage = MessageUtils.toMessageState(
					await globalThis.prisma.message.create({
						data: {
							id: modelMessageId,
							user: { connect: { id: action.userId } },
							folder: { connect: { id: action.folderId } },
							chat: { connect: { id: action.chatId } },
							config: zConfig.parse(action.config),
							author: Author.MODEL,
							data: [],
							metadata: [],
							previous: { connect: { id: userMessage.id } },
						},
					}),
				);

				const { data, metadata } = await ServerAgentService.runAgent({
					chat,
					context: {
						user,
						chat,
						messages: [...messages, userMessage, modelMessage].map(
							(m): zAgentMessage => ({
								id: m.id,
								author: m.author,
								data: m.data,
								config: m.config,
								createdAt: m.createdAt,
							}),
						),
						timezone: action.timezone,
						interactive: false,
					},
					config: zConfig.parse(action.config),
					prompt: userMessage,
				});

				await globalThis.prisma.message.update({
					where: { id: modelMessageId },
					data: { data, metadata },
				});

				console.log(
					`[WorkerService] action complete:`,
					action,
					userMessage,
					modelMessage,
				);
			} catch (error) {
				console.error(
					`[WorkerService] error running action ${action.id}:`,
					error,
				);
			}
		}

		running = false;
	},
} as const;
