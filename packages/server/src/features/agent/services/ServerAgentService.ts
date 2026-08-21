import { zProviderEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import type { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	MessageState,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { SkillUtils } from "@tiny-chat/core/src/features/skill/utils/SkillUtils.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import { ServerCapabilityService } from "../../../core/services/ServerCapabilityService.ts";

export const ServerAgentService = {
	runAgent: async ({
		chat,
		context,
		config,
		prompt,
	}: {
		chat: ChatState;
		context: zAgentContext;
		config: zConfig;
		prompt: MessageState;
	}) => {
		const skills = (
			await globalThis.prisma.upload.findMany({
				where: { userId: context.user.id, type: "SKILL" },
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
				console.warn("[ServerAgentService] failed to build skill:", error);
				return [];
			}
		});

		const modelProvider = ModelProviderService.providers.find(
			(provider) => provider.name === config.provider,
		);
		if (!modelProvider) {
			throw new Error(
				`[ServerAgentService] provider not found: ${config.provider}`,
			);
		}

		const capabilities = await ServerCapabilityService.getCapabilities({
			user: context.user,
			chat,
			message: prompt,
			messages: context.messages,
			incognito: chat.incognito,
		});

		const toolsets = await ToolService.getTools({
			capabilities,
			incognito: chat.incognito,
		});

		const data: zData = [];
		const metadata: zMetadata = [];

		const stream = AgentService.generate({
			provider: modelProvider,
			context,
			capabilities,
			toolsets,
			skills,
			data,
			metadata,
			env: { ...zProviderEnv.parse(process.env) },
			options: {},
		});

		for await (const _ of stream) {
			// nothing to do here
		}

		return { data, metadata };
	},
} as const;
