import type { TextStreamPart } from "ai";
import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/message.ts";
import { AnthropicProvider } from "./AnthropicProvider.ts";

describe("providers - anthropic", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "",
			text: "",
			providerMetadata: {
				anthropic: {
					signature: "__TEST__",
				},
			},
		};

		const signature = AnthropicProvider.getPartSignature?.({
			user: inject("shared_user"),
			config: testConfig(AnthropicProvider, "claude-sonnet-5"),
			event,
		});
		expect(signature?.model).toBe("claude-sonnet-5");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "thought",
			id: "",
			value: "",
			signature: {
				model: "claude-sonnet-5",
				reasoning: "__TEST__",
			},
		};

		const metadata = AnthropicProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AnthropicProvider, "claude-sonnet-5"),
			part,
		});
		expect(metadata?.anthropic?.signature).toBe("__TEST__");

		const metadata2 = AnthropicProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AnthropicProvider, "claude-sonnet-4"),
			part,
		});
		expect(metadata2?.anthropic?.signature).toBeUndefined();
	});
});
