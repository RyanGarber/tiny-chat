import {
	type AnthropicProvider as _AnthropicProvider,
	createAnthropic,
} from "@ai-sdk/anthropic";
import { type AzureOpenAIProvider, createAzure } from "@ai-sdk/azure";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider, zModel } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";
import { AnthropicProvider } from "./AnthropicProvider.ts";
import { OpenAiProvider } from "./OpenAiProvider.ts";

const useResponses = (model: string) =>
	ModelProviderUtils.isModel(model, "gpt", "o1", "o3", "o4");

export const AzureProvider: ModelProvider<
	AzureOpenAIProvider | _AnthropicProvider
> = {
	name: "azure",
	type: "model",
	settings: ["resourceId", "projectId", "apiKey"],

	getSdk({ user, model }) {
		const settings = user?.settings?.providers?.azure;
		if (!settings?.resourceId || !settings?.apiKey) return null;

		if (ModelProviderUtils.isModel(model, "claude")) {
			return createAnthropic({
				baseURL: `https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/anthropic/v1`,
				apiKey: settings.apiKey as string,
			});
		}

		return createAzure({
			resourceName: settings.resourceId as string,
			apiKey: settings.apiKey as string,
		});
	},

	getSdkOptions({ user, config, env }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getSdkOptions({ user, config, env });
		}

		if (useResponses(config.model)) {
			return {
				azure: OpenAiProvider.getSdkOptions({ user, config, env })?.openai,
			};
		}

		return OpenAiProvider.getSdkOptions({ user, config, env });
	},

	async getStatus({ user }) {
		const settings = user?.settings?.providers?.azure;
		if (!settings?.resourceId || !settings?.projectId || !settings?.apiKey)
			return { valid: false, models: [] };

		try {
			const response = await fetch(
				`https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/api/projects/${encodeURIComponent(settings.projectId as string)}/deployments?api-version=v1`,
				{ headers: { Authorization: `Bearer ${settings.apiKey}` } },
			);

			const json = (await response.json()) as {
				value: { name: string }[];
			};

			return {
				valid: true,
				models: json.value.map(({ name }): zModel => {
					if (ModelProviderUtils.isModel(name, "claude")) {
						return {
							name: name,
							features: ["language", "language:tools"],
							args: this.getModelArgs({ model: name }),
						};
					}

					return {
						name: name,
						features: useResponses(name)
							? ["language", "language:tools"]
							: ["language"],
						args: this.getModelArgs({ model: name }),
					};
				}),
			};
		} catch (error) {
			return {
				valid: false,
				error: CommonUtils.getErrorFormatted({ error }),
				models: [],
			};
		}
	},

	getModelArgs({ model }) {
		if (ModelProviderUtils.isModel(model, "claude")) {
			return AnthropicProvider.getModelArgs({ model });
		}

		return OpenAiProvider.getModelArgs({ model });
	},

	getLanguageModel({ user, model, env }) {
		if (useResponses(model)) {
			return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
		}

		return this.getSdk({ user, model, env })?.chat(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getPartTransformed({ user, config, part }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return (
				AnthropicProvider.getPartTransformed?.({ user, config, part }) ?? [part]
			);
		}

		return (
			OpenAiProvider.getPartTransformed?.({ user, config, part }) ?? [part]
		);
	},

	getPartSignature({ user, config, event }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getPartSignature?.({ user, config, event });
		}

		if ("providerMetadata" in event) {
			return {
				model: config.model,
				item: event.providerMetadata?.azure?.itemId as any,
				reasoning: event.providerMetadata?.azure
					?.reasoningEncryptedContent as any,
			};
		}
	},

	getPartSignatureReturn({ user, config, part }) {
		if (ModelProviderUtils.isModel(config.model, "claude")) {
			return AnthropicProvider.getPartSignatureReturn?.({ user, config, part });
		}

		if ("signature" in part) {
			return {
				azure: {
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
