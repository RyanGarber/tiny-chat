import type { TextStreamPart } from "ai";
import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/message.ts";
import { OpenAiProvider } from "./OpenAiProvider.ts";

describe("providers - openai", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "",
			text: "",
			providerMetadata: {
				openai: {
					itemId: "__TEST__",
					reasoningEncryptedContent: "__TEST__",
				},
			},
		};
		const signature = OpenAiProvider.getPartSignature?.({
			user: inject("shared_user"),
			config: testConfig(OpenAiProvider, "gpt-5"),
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

		const metadata = OpenAiProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(OpenAiProvider, "gpt-5"),
			part,
		});
		expect(metadata?.openai?.itemId).toBe("__TEST__");
		expect(metadata?.openai?.reasoningEncryptedContent).toBe("__TEST__");

		const metadata2 = OpenAiProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(OpenAiProvider, "gpt-4"),
			part,
		});
		expect(metadata2?.openai?.itemId).toBe("__TEST__");
		expect(metadata2?.openai?.reasoningEncryptedContent).toBeUndefined();
	});
});
