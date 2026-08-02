import { createId } from "@paralleldrive/cuid2";
import { zProviderEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import type {
	zAgentContext,
	zAgentMessage,
} from "@tiny-chat/core/src/features/agent/types/agent.ts";
import {
	Author,
	zConfig,
	zData,
	type zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { SkillUtils } from "@tiny-chat/core/src/features/skill/utils/SkillUtils.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import { ServerCapabilityService } from "../../capability/services/ServerCapabilityService.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { MessageUtils } from "../../message/utils/MessageUtils.ts";

export const WorkerService = {
	next: async ({ testUserId }: { testUserId?: string }) => {
		const actions = await globalThis.prisma.action.findMany();
		const now = new Date();

		for (const action of actions) {
			try {
				const nextRunAt = CommonUtils.getScheduled({
					rrule: action,
					after: action.lastRanAt,
				});
				if ((!nextRunAt || nextRunAt > now) && testUserId !== action.userId)
					continue;
				console.log("starting action", action.id, "scheduled for", nextRunAt);

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

				const controller = new AbortController();

				const context: zAgentContext = {
					user,
					chat,
					messages: [...messages, userMessage].map(
						(m): zAgentMessage => ({
							id: m.id,
							author: m.author,
							data: m.data,
							config: m.config,
							createdAt: m.createdAt,
						}),
					),
					timezone: action.timezone,
				};

				const skills = (
					await globalThis.prisma.upload.findMany({
						where: { userId: action.userId, type: "SKILL" },
						include: { files: true },
					})
				).flatMap(({ files }) => {
					try {
						return (
							SkillUtils.buildSkill({
								files: files.map((file) => ({
									path: PathUtils.toMount(file),
									data: file.data,
								})),
							}) ?? []
						);
					} catch (error) {
						console.warn("Failed to build skill during action run:", error);
						return [];
					}
				});

				const data: zData = [];
				const metadata: zMetadata = [];

				const modelProvider = ModelProviderService.providers.find(
					(p) => p.name === userMessage.config.provider,
				);
				if (!modelProvider) {
					console.error(
						`Chat provider not found for action: ${userMessage.config.provider}`,
					);
					continue;
				}

				const capabilities = await ServerCapabilityService.getCapabilities({
					user,
					chat,
					message: userMessage,
					incognito: chat.incognito,
				});

				const toolsets = await ToolService.getTools({
					capabilities,
					incognito: chat.incognito,
				});

				const agent = AgentService.generate({
					provider: modelProvider,
					context,
					capabilities,
					toolsets,
					skills,
					data,
					metadata,
					env: { ...zProviderEnv.parse(process.env) },
					options: { abortSignal: controller.signal },
				});

				for await (const _ of agent) {
					// nothing to do here
				}

				const replyId = createId();
				await globalThis.prisma.message.create({
					data: {
						id: replyId,
						user: { connect: { id: action.userId } },
						folder: { connect: { id: action.folderId } },
						chat: { connect: { id: action.chatId } },
						config: zConfig.parse(action.config),
						author: Author.MODEL,
						data: [],
						metadata: [],
						previous: { connect: { id: userMessage.id } },
					},
				});

				console.log(`action complete:`, action);

				await globalThis.prisma.message.update({
					where: { id: replyId },
					data: {
						data,
						metadata,
					},
				});
			} catch (e) {
				console.error(`Error running action ${action.id}:`, e);
			}
		}
	},
} as const;
