import { zProviderEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { AgentService } from "@tiny-chat/core/src/features/agent/services/AgentService.ts";
import type { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { zChat } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	MessageState,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { ModelProviderService } from "@tiny-chat/core/src/features/provider/services/ModelProviderService.ts";
import { SkillUtils } from "@tiny-chat/core/src/features/skill/utils/SkillUtils.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import chalk from "chalk";
import { ServerCapabilityService } from "../../../core/services/ServerCapabilityService.ts";

export const ServerAgentService = {
	runAgent: async ({
		chat,
		context,
		prompt,
		instructions,
		toolNames,
	}: {
		chat: zChat | null;
		prompt: MessageState | null;
		context: zAgentContext;
		/** Override normal chat instructions for a specialized agent run. */
		instructions?: string;
		/** Optional tool allowlist. */
		toolNames?: string[];
	}) => {
		const skills = (
			await globalThis.db.orm.public.Upload.where({
				userId: context.user.id,
				kind: "SKILL",
			})
				.include("files", (file) => file.select("path", "data"))
				.all()
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

		const { prompt: lastPrompt } = AgentUtils.getLastPrompt({
			messages: context.messages,
			withText: false,
		});
		const modelProvider = ModelProviderService.providers.find(
			(provider) => provider.name === lastPrompt?.config?.provider,
		);
		if (!modelProvider) {
			throw new Error(
				`[ServerAgentService] provider not found: ${lastPrompt?.config?.provider}`,
			);
		}

		const capabilities = await ServerCapabilityService.getCapabilities({
			user: context.user,
			chat,
			message: prompt,
			messages: context.messages,
			incognito: chat?.incognito,
			temporary: chat?.temporary,
		});

		let toolsets = await ToolService.getTools({
			capabilities,
		});

		if (toolNames) {
			toolsets = toolsets
				.map((toolset) => ({
					...toolset,
					tools: toolset.tools.filter((tool) => toolNames.includes(tool.name)),
				}))
				.filter((toolset) => toolset.tools.length > 0);
		}

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
			instructions,
		});

		let lastId = "";
		for await (const part of stream) {
			if (part.type === "start") {
				console.log("-- start --");
			} else if (part.type === "data") {
				if (part.value.id !== lastId) {
					console.log(`[${part.value.type}] `);
					lastId = part.value.id;
				}
				if (part.value.type === "thought") {
					process.stdout.write(chalk.dim(part.value.value));
				} else if (part.value.type === "toolCall") {
					process.stdout.write(
						chalk.dim(
							`${part.value.name}(${JSON.stringify(part.value.input)})`,
						),
					);
				} else if (part.value.type === "toolResult") {
					process.stdout.write(
						chalk.dim(
							`${part.value.error ? chalk.redBright(">") : ">"} ${JSON.stringify(part.value.output)}`,
						),
					);
				} else if (part.value.type === "text") {
					process.stdout.write(chalk.dim(part.value.value));
				}
			} else if (part.type === "end") {
				console.log("\n-- end --");
			}
		}

		return { data, metadata };
	},
} as const;
