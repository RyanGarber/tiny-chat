import type { TextStreamPart } from "ai";
import { mockConfig, mockUser } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/part.ts";
import { AnthropicProvider } from "./AnthropicProvider.ts";

describe("AnthropicProvider", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "thought-1",
			text: "",
			providerMetadata: {
				anthropic: {
					signature: "__TEST__",
				},
			},
		};

		const signature = AnthropicProvider.getPartSignature?.({
			user: mockUser(),
			config: mockConfig(AnthropicProvider, "claude-sonnet-5"),
			event,
		});
		expect(signature?.model).toBe("claude-sonnet-5");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "thought",
			id: "thought-1",
			value: "",
			signature: {
				model: "claude-sonnet-5",
				reasoning: "__TEST__",
			},
		};

		const metadata = AnthropicProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AnthropicProvider, "claude-sonnet-5"),
			part,
		});
		expect(metadata?.anthropic?.signature).toBe("__TEST__");

		const metadata2 = AnthropicProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AnthropicProvider, "claude-sonnet-4"),
			part,
		});
		expect(metadata2?.anthropic?.signature).toBeUndefined();
	});
});
