import type {
	OpenAICompatibleProvider,
	OpenAICompatibleProviderOptions,
} from "@ai-sdk/openai-compatible";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider, zModel } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";

export const CustomProvider: ModelProvider<OpenAICompatibleProvider> = {
	name: "custom",
	type: "model",
	settings: ["baseUrl", "apiKey"],

	getSdk({ user }) {
		if (!user?.settings?.providers?.custom?.baseUrl) return null;
		return createOpenAICompatible({
			name: "custom",
			baseURL: user.settings.providers.custom.baseUrl,
			apiKey: user.settings.providers.custom.apiKey,
		});
	},

	getSdkOptions() {
		return {} satisfies OpenAICompatibleProviderOptions;
	},

	async getStatus({ user }) {
		if (!user?.settings?.providers?.custom?.baseUrl)
			return { valid: false, models: [] };

		let baseUrl = user.settings.providers.custom.baseUrl;
		if (baseUrl.slice(-1) !== "/") baseUrl = `${baseUrl}/`;

		const apiKey = user.settings.providers.custom.apiKey;

		try {
			const response = await fetch(
				`${baseUrl}models`,
				apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {},
			);

			const { data } = (await response.json()) as { data: { id: string }[] };

			return {
				valid: true,
				models: data.map((model): zModel => {
					return {
						name: model.id,
						features: ["language", "language:tools"],
						args: this.getModelArgs({ model: model.id }),
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

	getModelArgs() {
		return ModelProviderUtils.getModelArgs({ maxTemp: -1 });
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
};
