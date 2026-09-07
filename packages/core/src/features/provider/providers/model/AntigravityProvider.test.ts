import type { TextStreamPart } from "ai";
import { mockConfig, mockUser } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/part.ts";
import { AntigravityProvider } from "./AntigravityProvider.ts";

describe("AntigravityProvider", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "tool-call",
			toolCallId: "tool-call-1",
			toolName: "",
			input: {},
			providerMetadata: {
				"antigravity-proxy": {
					thoughtSignature: "__TEST__",
				},
			},
		};

		const signature = AntigravityProvider.getPartSignature?.({
			user: mockUser(),
			config: mockConfig(AntigravityProvider, "gemini-3-flash"),
			event,
		});
		expect(signature?.model).toBe("gemini-3-flash");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "toolCall",
			id: "tool-call-1",
			name: "",
			input: {},
			signature: {
				model: "gemini-3-flash",
				reasoning: "__TEST__",
			},
		};

		const metadata = AntigravityProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AntigravityProvider, "gemini-3-flash"),
			part,
		});
		expect(metadata?.["antigravity-proxy"]?.thoughtSignature).toBe("__TEST__");

		const metadata2 = AntigravityProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(AntigravityProvider, "gemini-3-pro"),
			part,
		});
		expect(metadata2?.["antigravity-proxy"]?.thoughtSignature).toBe(
			"skip_thought_signature_validator",
		);
	});
});
