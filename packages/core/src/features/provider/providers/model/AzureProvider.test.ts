import type { TextStreamPart } from "ai";
import { mockConfig, mockUser } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/part.ts";
import { AzureProvider } from "./AzureProvider.ts";

describe("AzureProvider", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "thought-1",
			text: "",
			providerMetadata: {
				azure: {
					itemId: "__TEST__",
					reasoningEncryptedContent: "__TEST__",
				},
			},
		};
		const signature = AzureProvider.getPartSignature?.({
			user: mockUser(),
			config: mockConfig(AzureProvider, "gpt-5"),
			event,
		});
		expect(signature?.model).toBe("gpt-5");
		expect(signature?.item).toBe("__TEST__");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "thought",
			id: "thought-1",
			value: "",
			signature: {
				model: "gpt-5",
				item: "__TEST__",
				reasoning: "__TEST__",
			},
		};

		const metadata = AzureProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AzureProvider, "gpt-5"),
			part,
		});
		expect(metadata?.azure?.itemId).toBe("__TEST__");
		expect(metadata?.azure?.reasoningEncryptedContent).toBe("__TEST__");

		const metadata2 = AzureProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AzureProvider, "gpt-4"),
			part,
		});
		expect(metadata2?.azure?.itemId).toBe("__TEST__");
		expect(metadata2?.azure?.reasoningEncryptedContent).toBeUndefined();
	});

	it("provides the appropriate provider options", () => {
		const options = AzureProvider.getSdkOptions({
			user: mockUser(),
			config: mockConfig(AzureProvider, "gpt-5"),
			env: {},
		});
		expect(options?.azure?.reasoningSummary).toBe("detailed");

		const options2 = AzureProvider.getSdkOptions({
			user: mockUser(),
			config: mockConfig(AzureProvider, "claude-sonnet-5"),
			env: {},
		});
		expect(options2?.anthropic?.thinking?.type).toBe("adaptive");

		const options3 = AzureProvider.getSdkOptions({
			user: mockUser(),
			config: mockConfig(AzureProvider, "deepseek-r1"),
			env: {},
		});
		expect(options3?.openai?.reasoningSummary).toBe("detailed");
	});
});
