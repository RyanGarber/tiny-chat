import {
	type AmazonBedrockLanguageModelOptions,
	type AmazonBedrockProvider,
	createAmazonBedrock,
} from "@ai-sdk/amazon-bedrock";
import {
	type AmazonBedrockAnthropicProvider,
	createBedrockAnthropic,
} from "@ai-sdk/amazon-bedrock/anthropic";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider, zModel, zModelArg } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";
import { AnthropicProvider } from "./AnthropicProvider.ts";

const INFERENCE_PROFILES: Record<string, string> = {
	"amazon.nova-2-lite-v1:0": "global.amazon.nova-2-lite-v1:0",
	"anthropic.claude-fable-5": "global.anthropic.claude-fable-5",
	"anthropic.claude-haiku-4-5-20251001-v1:0":
		"global.anthropic.claude-haiku-4-5-20251001-v1:0",
	"anthropic.claude-opus-4-5-20251101-v1:0":
		"global.anthropic.claude-opus-4-5-20251101-v1:0",
	"anthropic.claude-opus-4-6-v1": "global.anthropic.claude-opus-4-6-v1",
	"anthropic.claude-sonnet-4-6": "global.anthropic.claude-sonnet-4-6",
	"anthropic.claude-sonnet-4-20250514-v1:0":
		"global.anthropic.claude-sonnet-4-20250514-v1:0",
	"anthropic.claude-sonnet-4-5-20250929-v1:0":
		"global.anthropic.claude-sonnet-4-5-20250929-v1:0",
	"anthropic.claude-sonnet-5":
		"arn:aws:bedrock:us-east-1:366731215520:inference-profile/us.anthropic.claude-sonnet-5",
	"cohere.embed-v4:0": "global.cohere.embed-v4:0",
	"twelvelabs.pegasus-1-2-v1:0": "global.twelvelabs.pegasus-1-2-v1:0",
};

export const AwsProvider: ModelProvider<
	AmazonBedrockProvider | AmazonBedrockAnthropicProvider
> = {
	name: "aws",
	type: "model",
	settings: ["apiKey"],

	getSdk({ user, model }) {
		if (!user.settings?.providers?.aws?.apiKey) return null;

		if (ModelProviderUtils.isModel(model, "claude")) {
			return createBedrockAnthropic({
				region: "us-east-1",
				apiKey: user.settings.providers?.aws.apiKey as string,
			});
		}

		return createAmazonBedrock({
			region: "us-east-1",
			apiKey: user.settings.providers.aws.apiKey as string,
		});
	},

	async getStatus({ user }) {
		if (!user?.settings?.providers?.aws?.apiKey)
			return { valid: false, models: [] };

		try {
			const models = (await (
				await fetch(
					"https://bedrock.us-east-1.amazonaws.com/foundation-models",
					{
						headers: {
							Authorization: `Bearer ${user.settings.providers.aws.apiKey}`,
						},
					},
				)
			).json()) as {
				modelSummaries: {
					modelId: string;
					outputModalities: ("TEXT" | "IMAGE" | "EMBEDDING")[];
				}[];
			};

			return {
				valid: true,
				models: models.modelSummaries.flatMap(
					({ modelId, outputModalities }): zModel[] => {
						if (ModelProviderUtils.isModel(modelId, "claude")) {
							return [
								{
									name: modelId,
									features: ["language", "language:tools"],
									args: this.getModelArgs({ model: modelId }),
								} satisfies zModel,
							];
						}

						return [
							{
								name: modelId,
								features: outputModalities.includes("TEXT")
									? ["language", "language:tools"]
									: outputModalities.includes("EMBEDDING")
										? ["embedding"]
										: [],
								args: this.getModelArgs({ model: modelId }),
							} satisfies zModel,
						];
					},
				),
			};
		} catch (error) {
			return {
				valid: false,
				error: CommonUtils.formatError({ error }),
				models: [],
			};
		}
	},

	getModelArgs({ model }) {
		if (ModelProviderUtils.isModel(model, "claude")) {
			return AnthropicProvider.getModelArgs({ model });
		}

		const args: zModelArg[] = [];
		if (ModelProviderUtils.isModel(model, "nova")) {
			args.push({
				name: "thinking",
				type: "list" as const,
				values: ["none", "low", "medium", "high"],
				default: "medium",
			});
		}
		return args;
	},

	getLanguageModel({ user, model, env }) {
		if (INFERENCE_PROFILES[model]) model = INFERENCE_PROFILES[model];
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getSdkOptions({ user, config, env }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getSdkOptions({ user, config, env });
		}

		return {
			bedrock: {
				reasoningConfig: {
					type: config.args?.thinking !== "none" ? "enabled" : "disabled",
					maxReasoningEffort:
						config.args?.thinking !== "none"
							? config.args?.thinking
							: undefined,
				},
			} satisfies AmazonBedrockLanguageModelOptions,
		};
	},

	getPartTransformed({ user, config, part }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getPartTransformed?.({
				user,
				config,
				part,
			});
		}
	},

	getPartSignature({ user, config, event }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getPartSignature?.({ user, config, event });
		}
	},

	getPartSignatureReturn({ user, config, part }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getPartSignatureReturn?.({
				user,
				config,
				part,
			});
		}
	},
};
