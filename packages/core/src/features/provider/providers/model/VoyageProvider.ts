import {
	type VoyageProvider as _VoyageProvider,
	createVoyage,
} from "voyage-ai-provider";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";

const MODELS = [
	"voyage-3-large",
	"voyage-code-3",
	"voyage-multilingual-2",
	"voyage-law-2",
	"voyage-01",
	"voyage-lite-01",
	"voyage-code-2",
	"voyage-large-2",
	"voyage-large-2-instruct",
	"voyage-lite-02-instruct",
	"voyage-2",
	"voyage-finance-2",
	"voyage-lite-01-instruct",
	"voyage-context-3",
	"voyage-3",
	"voyage-3.5",
	"voyage-4",
	"rerank-1",
	"rerank-2",
	"rerank-2.5",
	"voyage-multimodal-3",
	"voyage-multimodal-3.5",
	"rerank-2-lite",
	"rerank-lite-1",
	"rerank-2.5-lite",
	"voyage-3-lite",
	"voyage-3.5-lite",
	"voyage-4-lite",
	"voyage-4-large",
	"voyage-context-4",
];

export const VoyageProvider: ModelProvider<_VoyageProvider> = {
	name: "voyage",
	type: "model",
	settings: ["apiKey"],

	getSdk({ user }) {
		if (!user.settings.providers?.voyage?.apiKey) return null;
		return createVoyage({ apiKey: user.settings.providers.voyage.apiKey });
	},

	getLanguageModel() {
		return null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getSdkOptions() {
		return {};
	},

	async getStatus({ user }) {
		if (!user.settings.providers?.voyage?.apiKey)
			return { valid: false, models: [] };

		try {
			const response = await fetch("https://api.voyageai.com/v1/embeddings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${user.settings.providers.voyage.apiKey}`,
				},
				body: JSON.stringify({ input: "1", model: "" }),
			});

			if (response.status === 401) {
				return {
					valid: false,
					error: `${response.status} ${response.statusText}`,
					models: [],
				};
			}

			return {
				valid: true,
				models: MODELS.map((model) => ({
					name: model,
					features: ModelProviderUtils.isModel(model, "voyage")
						? ["embedding"]
						: [],
					args: this.getModelArgs({ model }),
				})),
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
		return [];
	},
};
