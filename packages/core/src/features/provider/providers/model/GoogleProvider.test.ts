import type { TextStreamPart } from "ai";
import { mockConfig, mockUser } from "../../../../tests.ts";
import type { zAgentMessage } from "../../../agent/types/agent.ts";
import type { zDataPart } from "../../../data/types/part.ts";
import { ModelTransformService } from "../../services/ModelTransformService.ts";
import { GoogleProvider } from "./GoogleProvider.ts";

describe("GoogleProvider", () => {
	it("stores signatures", () => {
		const event: TextStreamPart<any> = {
			type: "reasoning-delta",
			id: "id",
			text: "",
			providerMetadata: {
				google: {
					thoughtSignature: "__TEST__",
				},
			},
		};
		const signature = GoogleProvider.getPartSignature?.({
			user: mockUser(),
			config: mockConfig(GoogleProvider, "gemini-3-flash"),
			event,
		});
		expect(signature?.model).toBe("gemini-3-flash");
		expect(signature?.reasoning).toBe("__TEST__");
	});

	it("returns matching signatures", () => {
		const part: zDataPart = {
			type: "thought",
			id: "id",
			value: "",
			signature: {
				model: "gemini-3-flash",
				reasoning: "__TEST__",
			},
		};

		const metadata = GoogleProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(GoogleProvider, "gemini-3-flash"),
			part,
		});
		expect(metadata?.google?.thoughtSignature).toBe("__TEST__");

		const metadata2 = GoogleProvider.getPartSignatureReturn?.({
			user: mockUser(),
			config: mockConfig(GoogleProvider, "gemini-3-pro"),
			part,
		});
		expect(metadata2?.google?.thoughtSignature).toBe(
			"skip_thought_signature_validator",
		);
	});

	it("transforms youtube links to video parts", async () => {
		const part: zDataPart = {
			id: "id",
			type: "text",
			value: "content: https://www.youtube.com/watch?v=___________",
		};
		const transformed = await GoogleProvider.getPartTransformed?.({
			user: mockUser(),
			config: mockConfig(GoogleProvider, "gemini-3-flash"),
			part,
		});
		expect.assert(transformed?.[1].type === "file");
		expect(transformed?.[1].mime).toBe("video/mp4");
		expect(transformed?.[1].data).toBe(
			"https://www.youtube.com/watch?v=___________",
		);
	});

	it("preserves multimodal tool results", async () => {
		const message: zAgentMessage = {
			author: "USER",
			id: null,
			data: [
				[
					{
						type: "toolResult",
						id: "id",
						name: "name",
						output: [
							{
								id: "id",
								type: "file",
								name: "file.exe",
								mime: "application/octet-stream",
								data: "",
							},
							{
								id: "id",
								type: "file",
								name: "file.png",
								mime: "image/png",
								data: "",
							},
						],
					},
				],
			],
			config: mockConfig(GoogleProvider, "gemini-3-flash"),
			createdAt: null,
		};
		const transformed = await ModelTransformService.toSdkMessages({
			user: mockUser(),
			config: mockConfig(GoogleProvider, "gemini-3-flash"),
			provider: GoogleProvider,
			messages: [message],
		});
		expect.assert(Array.isArray(transformed[0].content));
		expect.assert(transformed[0].content[0].type === "tool-result");
		expect.assert(transformed[0].content[0].output.type === "content");

		const content = transformed[0].content[0].output.value;

		expect.assert(content[0].type === "text");
		expect(content[0].text).toContain("Unsupported");

		expect.assert(content[1].type === "file");
		expect(content[1].mediaType).toBe("image/png");
	});
});
