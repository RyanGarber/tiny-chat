import type { TextStreamPart } from "ai";
import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/message.ts";
import { AzureProvider } from "./AzureProvider.ts";

describe("providers - azure", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "",
			text: "",
			providerMetadata: {
				azure: {
					itemId: "__TEST__",
					reasoningEncryptedContent: "__TEST__",
				},
			},
		};
		const signature = AzureProvider.getPartSignature?.({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "gpt-5"),
			event,
		});
		expect(signature?.model).toBe("gpt-5");
		expect(signature?.item).toBe("__TEST__");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "thought",
			id: "",
			value: "",
			signature: {
				model: "gpt-5",
				item: "__TEST__",
				reasoning: "__TEST__",
			},
		};

		const metadata = AzureProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "gpt-5"),
			part,
		});
		expect(metadata?.azure?.itemId).toBe("__TEST__");
		expect(metadata?.azure?.reasoningEncryptedContent).toBe("__TEST__");

		const metadata2 = AzureProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "gpt-4"),
			part,
		});
		expect(metadata2?.azure?.itemId).toBe("__TEST__");
		expect(metadata2?.azure?.reasoningEncryptedContent).toBeUndefined();
	});

	it("provides the appropriate provider options", () => {
		const options = AzureProvider.getSdkOptions({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "gpt-5"),
			env: {},
		});
		expect(options?.azure?.reasoningSummary).toBe("detailed");

		const options2 = AzureProvider.getSdkOptions({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "claude-sonnet-5"),
			env: {},
		});
		expect(options2?.anthropic?.thinking?.type).toBe("adaptive");

		const options3 = AzureProvider.getSdkOptions({
			user: inject("shared_user"),
			config: testConfig(AzureProvider, "deepseek-r1"),
			env: {},
		});
		expect(options3?.openai?.reasoningSummary).toBe("detailed");
	});
});
