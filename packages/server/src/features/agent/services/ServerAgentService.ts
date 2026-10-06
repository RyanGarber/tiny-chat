import chalk from "chalk";
import { zProviderEnv } from "#core/core/types/env.ts";
import { AgentService } from "#core/features/agent/services/AgentService.ts";
import type {
	zAgentChat,
	zAgentContext,
} from "#core/features/agent/types/agent.ts";
import { AgentUtils } from "#core/features/agent/utils/AgentUtils.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zData, zMetadata } from "#core/features/data/types/part.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import { ModelProviderService } from "#core/features/provider/services/ModelProviderService.ts";
import { SkillUtils } from "#core/features/skill/utils/SkillUtils.ts";
import { ToolService } from "#core/features/tool/services/ToolService.ts";
import { ServerCapabilityService } from "#server/core/services/ServerCapabilityService.ts";

export const ServerAgentService = {
	runAgent: async ({
		chat,
		context,
		prompt,
		instructions,
		toolNames,
	}: {
		chat: zAgentChat | null;
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
