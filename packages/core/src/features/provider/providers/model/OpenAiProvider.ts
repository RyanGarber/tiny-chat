import type {
	OpenAIProvider as _OpenAIProvider,
	OpenAILanguageModelResponsesOptions,
} from "@ai-sdk/openai";
import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider, zModel, zModelArg } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";

export const OpenAiProvider: ModelProvider<_OpenAIProvider> = {
	name: "openai",
	type: "model",
	settings: ["apiKey"],

	getSdk({ user }) {
		if (!user?.settings?.providers?.openai?.apiKey) return null;
		return createOpenAI({
			apiKey: user.settings.providers.openai.apiKey as string,
		});
	},

	getSdkOptions({ config }) {
		const openai: OpenAILanguageModelResponsesOptions = {
			reasoningEffort: config.args?.reasoning,
			reasoningSummary: "detailed",
		};
		if (ModelProviderUtils.isModel(config.model, "gpt 4", "gpt 5")) {
			openai.include = ["reasoning.encrypted_content"];
		}
		return { openai };
	},

	async getStatus({ user }) {
		if (!user?.settings?.providers?.openai?.apiKey)
			return { valid: false, models: [] };

		try {
			const client = new OpenAI({
				apiKey: user.settings.providers.openai.apiKey as string,
				dangerouslyAllowBrowser: true,
			});

			const models = await client.models.list();

			return {
				valid: true,
				models: models.data.flatMap(({ id }): zModel[] => {
					if (
						ModelProviderUtils.isModel(
							id,
							"audio",
							"realtime",
							"search",
							"transcribe",
							"tts",
							"whisper",
							"sora",
							"moderation",
						)
					)
						return [];

					if (ModelProviderUtils.isModel(id, "embedding"))
						return [
							{
								name: id,
								features: ["embedding"],
								args: [],
							} satisfies zModel,
						];

					return [
						{
							name: id,
							features: ["language", "language:tools"],
							args: this.getModelArgs({ model: id }),
						} satisfies zModel,
					];
				}),
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
		const args: zModelArg[] = [];

		if (ModelProviderUtils.isModel(model, "gpt", "o1", "o3", "o4")) {
			const isReasoning = ModelProviderUtils.isModel(
				model,
				"gpt 5",
				"gpt 4o",
				"o1",
				"o3",
				"o4",
			);

			args.push(
				...ModelProviderUtils.getModelArgs({ maxTemp: isReasoning ? -1 : 2 }),
			);

			if (isReasoning) {
				if (ModelProviderUtils.isModel(model, "gpt")) {
					args.push({
						name: "reasoning",
						type: "list",
						values: ["none", "minimal", "low", "medium", "high", "xhigh"],
						default: "medium",
					});
				}
			}
		}
		return args;
	},

	getLanguageModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getPartTransformed({ part }) {
		return [
			ModelProviderUtils.getPartTransformed({
				part,
				supportedFileTypes: ["image/", "application/pdf"],
			}),
		];
	},

	getPartSignature({ config, event }) {
		if ("providerMetadata" in event) {
			return {
				model: config.model,
				item: event.providerMetadata?.openai?.itemId as string,
				reasoning: event.providerMetadata?.openai
					?.reasoningEncryptedContent as string,
			};
		}
	},

	getPartSignatureReturn({ config, part }) {
		if ("signature" in part) {
			return {
				openai: {
					itemId: part.signature?.item,
					reasoningEncryptedContent:
						part.signature?.model === config.model
							? part.signature?.reasoning
							: undefined,
				},
			};
		}
	},
};
