import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import type { Model } from "../../types/chat.ts";
import { isModelVersion } from "../../utils.ts";
import { AnthropicProvider } from "./anthropic.ts";
import type { ChatProvider } from "./index.ts";
import { OpenAIProvider } from "./openai.ts";

const useResponses = (id: string) =>
	isModelVersion(id, "gpt", "o1", "o3", "o4");

export const AzureProvider: ChatProvider = {
	name: "azure",
	settings: ["resourceId", "projectId", "apiKey"],

	getClient(user) {
		const settings = user?.settings?.providers?.azure;
		if (!settings?.resourceId || !settings?.apiKey) return null;
		return createAzure({
			resourceName: settings.resourceId as string,
			apiKey: settings.apiKey as string,
		});
	},

	getClientGenerateModel(user, id, env) {
		const client = this.getClient(user, env) as ReturnType<typeof createAzure>;
		if (!client) return null;

		if (isModelVersion(id, "claude")) {
			const settings = user?.settings?.providers?.azure;
			return createAnthropic({
				baseURL: `https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/anthropic/v1`,
				apiKey: settings.apiKey as string,
			}).languageModel(id);
		}

		if (useResponses(id)) {
			return client.languageModel(id);
		}

		return client.chat(id);
	},

	getClientEmbedModel(user, id, env) {
		const client = this.getClient(user, env) as ReturnType<typeof createAzure>;
		if (!client) return null;
		return client.embeddingModel(id);
	},

	getClientOptions(user, config, env) {
		if (isModelVersion(config.model, "claude")) {
			return AnthropicProvider.getClientOptions(user, config, env);
		}

		if (useResponses(config.model)) {
			return {
				azure: OpenAIProvider.getClientOptions(user, config, env)?.openai,
			};
		}

		return OpenAIProvider.getClientOptions(user, config, env);
	},

	getPartTransformed(user, config, part) {
		if (isModelVersion(config.model, "claude")) {
			return (
				AnthropicProvider.getPartTransformed?.(user, config, part) ?? [part]
			);
		}

		return OpenAIProvider.getPartTransformed?.(user, config, part) ?? [part];
	},

	getPartSignature(user, config, part) {
		if (isModelVersion(config.model, "claude")) {
			return AnthropicProvider.getPartSignature?.(user, config, part);
		}

		if ("providerMetadata" in part) {
			return {
				model: config.model,
				item: part.providerMetadata?.azure?.itemId as any,
				reasoning: part.providerMetadata?.azure
					?.reasoningEncryptedContent as any,
			};
		}
	},

	getPartSignatureReturn(user, config, part) {
		if (isModelVersion(config.model, "claude")) {
			return AnthropicProvider.getPartSignatureReturn?.(user, config, part);
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

	async getModels(user) {
		const settings = user?.settings?.providers?.azure;
		if (!settings?.resourceId || !settings?.projectId || !settings?.apiKey)
			return [];

		try {
			const deployments = await fetch(
				`https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/api/projects/${encodeURIComponent(settings.projectId as string)}/deployments?api-version=v1`,
				{ headers: { Authorization: `Bearer ${settings.apiKey}` } },
			);

			if (!deployments.ok) return [];

			const json = (await deployments.json()) as {
				value: { name: string }[];
			};

			return json.value.map((d) => {
				if (isModelVersion(d.name, "claude")) {
					return {
						name: d.name,
						features: ["generate" as const, "toolCall" as const],
						args: this.getModelArgs(d.name),
					} satisfies Model;
				}

				return {
					name: d.name,
					features: useResponses(d.name)
						? ["generate" as const, "toolCall" as const]
						: ["generate" as const],
					args: this.getModelArgs(d.name),
				} satisfies Model;
			});
		} catch (e) {
			console.error("Failed to fetch Azure models", e);
			return [];
		}
	},

	getModelArgs(model) {
		if (isModelVersion(model, "claude")) {
			return AnthropicProvider.getModelArgs(model);
		}

		return OpenAIProvider.getModelArgs(model);
	},
};
