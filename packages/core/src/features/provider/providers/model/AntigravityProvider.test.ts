import type { TextStreamPart } from "ai";
import { describe, expect, inject, it } from "vitest";
import { testConfig } from "../../../../tests.ts";
import type { zDataPart } from "../../../data/types/message.ts";
import { AntigravityProvider } from "./AntigravityProvider.ts";

describe("providers - antigravity", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "tool-call",
			toolCallId: "",
			toolName: "",
			input: {},
			providerMetadata: {
				"antigravity-proxy": {
					thoughtSignature: "__TEST__",
				},
			},
		};

		const signature = AntigravityProvider.getPartSignature?.({
			user: inject("shared_user"),
			config: testConfig(AntigravityProvider, "gemini-3-flash"),
			event,
		});
		expect(signature?.model).toBe("gemini-3-flash");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "toolCall",
			id: "",
			name: "",
			args: {},
			signature: {
				model: "gemini-3-flash",
				reasoning: "__TEST__",
			},
		};

		const metadata = AntigravityProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AntigravityProvider, "gemini-3-flash"),
			part,
		});
		expect(metadata?.["antigravity-proxy"]?.thoughtSignature).toBe("__TEST__");

		const metadata2 = AntigravityProvider.getPartSignatureReturn?.({
			user: inject("shared_user"),
			config: testConfig(AntigravityProvider, "gemini-3-pro"),
			part,
		});
		expect(metadata2?.["antigravity-proxy"]?.thoughtSignature).toBe(
			"skip_thought_signature_validator",
		);
	});
});
