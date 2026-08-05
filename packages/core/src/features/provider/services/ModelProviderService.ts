import {
	embedMany,
	Output,
	streamText,
	type TextStreamPart,
	type Tool,
} from "ai";
import { z } from "zod";
import type { zEnv } from "../../../core/types/env.ts";
import type { zAgentEvent } from "../../agent/types/agent.ts";
import type { zConfig } from "../../data/types/message.ts";
import type { zUser } from "../../data/types/user.ts";
import type { ToolDefinition } from "../../tool/types/tool.ts";
import { AnthropicProvider } from "../providers/model/AnthropicProvider.ts";
import { AntigravityProvider } from "../providers/model/AntigravityProvider.ts";
import { AwsProvider } from "../providers/model/AwsProvider.ts";
import { AzureProvider } from "../providers/model/AzureProvider.ts";
import { CustomProvider } from "../providers/model/CustomProvider.ts";
import { GoogleProvider } from "../providers/model/GoogleProvider.ts";
import { OpenAiProvider } from "../providers/model/OpenAiProvider.ts";
import { TestProvider } from "../providers/model/TestProvider.ts";
import { VoyageProvider } from "../providers/model/VoyageProvider.ts";
import type { ModelProvider, zModelMessage } from "../types/model.ts";
import { ModelProviderUtils } from "../utils/ModelProviderUtils.ts";
import { ModelTransformService } from "./ModelTransformService.ts";

export type RunLanguageModelOptions = Omit<
	Parameters<typeof streamText>[0],
	| "model"
	| "prompt"
	| "tools"
	| "messages"
	| "providerOptions"
	| "temperature"
	| "maxOutputTokens"
>;

export const ModelProviderService = {
	providers: [
		AnthropicProvider,
		AntigravityProvider,
		AwsProvider,
		AzureProvider,
		CustomProvider,
		GoogleProvider,
		OpenAiProvider,
		TestProvider,
		VoyageProvider,
	] satisfies ModelProvider<any>[],

	runLanguageModel: async function* ({
		user,
		provider,
		messages,
		config,
		tools,
		env,
		options = {},
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		messages: zModelMessage[];
		config: zConfig;
		tools: ToolDefinition[];
		env: Partial<zEnv>;
		options?: Partial<RunLanguageModelOptions>;
	}): AsyncGenerator<zAgentEvent> {
		const model = (await provider.getStatus({ user })).models.find(
			(m) => m.name === config.model,
		);
		const sdkModel = provider.getLanguageModel({
			user,
			model: config.model,
			env,
		});
		if (!model || !sdkModel)
			throw new Error(`model not found: ${config.model}`);

		config = ModelProviderUtils.getConfigDefaults({ config, args: model.args });

		const events: TextStreamPart<any>[] = [];

		const sdkMessages = ModelTransformService.toSdkMessages({
			user,
			config,
			provider,
			messages,
		});

		const sdkTools = model.features.includes("language:tools")
			? Object.fromEntries(
					tools.map((tool) => [
						tool.name,
						{
							description: tool.description,
							inputSchema: tool.input as z.ZodType,
						} satisfies Tool,
					]),
				)
			: undefined;

		const input = {
			...options,
			model: sdkModel,
			maxOutputTokens: config.args?.["tokens-out"],
			temperature: config.args?.temperature as number,
			providerOptions: provider?.getSdkOptions({ user, config, env }),
			output: config.schema
				? Output.object({ schema: z.fromJSONSchema(config.schema) })
				: undefined,
			tools: sdkTools,
			messages: sdkMessages,
		} satisfies Parameters<typeof streamText>[0];

		console.log("[ModelProviderService] final sdk input:", input);

		const { stream, output } = streamText(input);

		for await (const event of stream) {
			events.push(event);

			if (event.type === "start-step") {
				yield {
					type: "start",
					warnings: event.warnings,
				};
			}

			const part = ModelTransformService.fromSdkEvent({
				user,
				config,
				provider,
				event,
			});

			if (part) yield part;

			if (event.type === "finish" || event.type === "error") {
				yield {
					type: "end",
					metadata: events,
				};
			}
		}

		if (config.schema) {
			yield {
				type: "data",
				value: {
					type: "json",
					value: await output,
				},
			};
		}
	},

	runEmbeddingModel: async ({
		user,
		provider,
		config,
		env,
		values,
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		config: zConfig;
		env: Partial<zEnv>;
		values: string[];
	}) => {
		const sdkModel = provider.getEmbeddingModel({
			user,
			model: config.model,
			env,
		});
		if (!sdkModel)
			throw new Error(`No embedding model available for ${config.model}`);

		// no args used at the moment:
		// config = ModelProviderUtils.getConfigDefaults({ config, args: provider.getModelArgs({ model: config.model }) }));

		return (await embedMany({ model: sdkModel, values })).embeddings;
	},
};
