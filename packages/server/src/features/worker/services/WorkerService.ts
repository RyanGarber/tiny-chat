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

let running = false;

export const WorkerService = {
	next: async ({ testUserId }: { testUserId?: string }) => {
		if (running) {
			console.warn("ignoring worker run because one is already running");
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

				const controller = new AbortController();

				const context: zAgentContext = {
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
				};

				const skills = (
					await globalThis.prisma.upload.findMany({
						where: { userId: action.userId, type: "SKILL" },
						include: { files: true },
					})
				).flatMap(({ id, files }) => {
					try {
						return (
							SkillUtils.buildSkill({
								files: files.map((file) => ({
									path: PathUtils.toMount({
										mount: "skills",
										id,
										path: file.path,
									}),
									data: file.data,
								})),
							}) ?? []
						);
					} catch (error) {
						console.warn(
							"[WorkerService] failed to build skill for action:",
							error,
						);
						return [];
					}
				});

				const data: zData = [];
				const metadata: zMetadata = [];

				const modelProvider = ModelProviderService.providers.find(
					(provider) => provider.name === userMessage.config.provider,
				);
				if (!modelProvider) {
					console.error(
						`[WorkerService] provider not found for action: ${userMessage.config.provider}`,
					);
					continue;
				}

				const capabilities = await ServerCapabilityService.getCapabilities({
					user,
					chat,
					message: userMessage,
					messages: context.messages,
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

				console.log(`[WorkerService] action complete:`, action);

				await globalThis.prisma.message.update({
					where: { id: modelMessageId },
					data: {
						data,
						metadata,
					},
				});
			} catch (e) {
				console.error(`[WorkerService] error running action ${action.id}:`, e);
			}
		}

		running = false;
	},
} as const;
