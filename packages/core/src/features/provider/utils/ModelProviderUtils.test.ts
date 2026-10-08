import { describe, expect, it } from "vitest";
import { zConfig } from "#core/features/data/types/message.ts";
import type { zModel } from "#core/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
import { ModelProviderUtils } from "#core/features/provider/utils/ModelProviderUtils.ts";

const model = (name: string, features: zModel["features"]): zModel => ({
	name,
	features,
	args: [{ type: "range", name: "tokens-in", min: 1, max: 100, default: 50 }],
});

const providers: ProviderState<ProviderStatus>[] = [
	{
		name: "web",
		type: "web",
		settings: [],
		status: { valid: true },
	},
	{
		name: "a",
		type: "model",
		settings: [],
		status: {
			valid: true,
			models: [model("embed", ["embedding"]), model("chat", ["language"])],
		} as ProviderStatus,
	},
	{
		name: "b",
		type: "model",
		settings: [],
		status: {
			valid: true,
			models: [model("other", ["language", "language:tools"])],
		} as ProviderStatus,
	},
];

const config = (provider: string, model: string, args = {}) =>
	zConfig.parse({ provider, model, args, toolsets: ["shell"] });

describe("ModelProviderUtils.getConfigValid", () => {
	it("keeps the first candidate whose model is on offer", () => {
		const chosen = config("b", "other");
		expect(
			ModelProviderUtils.getConfigValid({
				candidates: [null, config("a", "gone"), chosen],
				providers,
			}),
		).toBe(chosen);
	});

	it("moves a removed model onto the first language model, keeping the rest", () => {
		expect(
			ModelProviderUtils.getConfigValid({
				candidates: [config("a", "gone", { "tokens-in": 10, nope: 1 })],
				providers,
			}),
		).toEqual(config("a", "chat", { "tokens-in": 10 }));
	});

	it("falls back from nothing at all, skipping hidden and non-language models", () => {
		expect(
			ModelProviderUtils.getConfigValid({
				candidates: [null, undefined],
				providers,
				hidden: [{ provider: "a", model: "chat" }],
			}),
		).toMatchObject({ provider: "b", model: "other" });
	});

	it("is null when no language model is on offer", () => {
		expect(
			ModelProviderUtils.getConfigValid({
				candidates: [config("a", "chat")],
				providers: providers.slice(0, 1),
			}),
		).toBeNull();
	});
});
