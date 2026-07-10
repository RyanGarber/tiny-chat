import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createAnthropic } from "@ai-sdk/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";
import type { Model, ModelArg } from "../../types/chat.ts";
import {
	getBaseModelArgs,
	getBaseModelTransform,
	isModelVersion,
} from "../../utils.ts";
import type { ChatProvider } from "./index.ts";

export const AnthropicProvider: ChatProvider = {
	name: "anthropic",
	settings: ["apiKey"],

	getClient(user) {
		const apiKey = user?.settings?.providers?.anthropic?.apiKey;
		if (!apiKey) return null;
		return createAnthropic({
			apiKey: apiKey as string,
			headers: { "anthropic-dangerous-direct-browser-access": "true" },
		});
	},

	getClientGenerateModel(user, id, env) {
		const client = this.getClient(user, env) as ReturnType<
			typeof createAnthropic
		>;
		if (!client) return null;
		return client.languageModel(id);
	},

	getClientEmbedModel() {
		return null;
	},

	getClientOptions(_user, config) {
		return {
			anthropic: {
				thinking:
					config.args?.thinking === "adaptive" ||
					config.args?.thinking === "disabled"
						? { type: config.args.thinking, display: "summarized" }
						: config.args?.thinking
							? {
									type: "enabled",
									budgetTokens: parseInt(config.args.thinking as string, 10),
								}
							: undefined,
				effort: config.args?.effort,
			} satisfies AnthropicLanguageModelOptions,
		};
	},

	async getModels(user) {
		const apiKey = user?.settings?.providers?.anthropic?.apiKey;
		if (!apiKey) return [];

		const client = new Anthropic({
			apiKey: apiKey as string,
			dangerouslyAllowBrowser: true,
		});

		const models = await client.models.list();

		return models.data.map((m) => {
			return {
				name: m.id,
				features: ["generate" as const, "toolCall" as const],
				args: this.getModelArgs(m.id),
			} satisfies Model;
		});
	},

	getPartTransformed(_user, _config, part) {
		return [getBaseModelTransform(part, "image/", "application/pdf")];
	},

	getPartSignature(_user, config, part) {
		if ("providerMetadata" in part) {
			return {
				model: config.model,
				reasoning: part.providerMetadata?.anthropic?.signature as any,
			};
		}
	},

	getPartSignatureReturn(_user, config, part) {
		if ("signature" in part) {
			return {
				anthropic: {
					signature:
						part.signature?.model === config.model
							? part.signature?.reasoning
							: undefined,
				},
			};
		}
	},

	getModelArgs(model) {
		const args: ModelArg[] = [];
		if (isModelVersion(model, "claude")) {
			args.push(...getBaseModelArgs(1));
			if (isModelVersion(model, "4.5")) {
				args.push({
					name: "thinking",
					type: "list" as const,
					values: ["disabled", "2500", "5000", "7500", "10000"],
					default: "2500",
				});
			}
			if (isModelVersion(model, "4.6", "4.7", "4.8", "5")) {
				args.push({
					name: "thinking",
					type: "list" as const,
					values: ["disabled", "adaptive"],
					default: "adaptive",
				});
			}
			if (isModelVersion(model, "opus 4.5", "sonnet 4.6", "opus 4.6")) {
				args.push({
					name: "effort",
					type: "list" as const,
					values: ["low", "medium", "high", "max"],
					default: "medium",
				});
			}
			if (
				isModelVersion(model, "opus 4.7", "opus 4.8", "sonnet 5", "fable 5")
			) {
				args.push({
					name: "effort",
					type: "list" as const,
					values: ["low", "medium", "high", "xhigh", "max"],
					default: "medium",
				});
			}
		}
		return args;
	},
};
