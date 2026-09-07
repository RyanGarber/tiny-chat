import { zConfig } from "../../data/types/message.ts";
import type { zData, zInterjectionPart } from "../../data/types/part.ts";
import { TestProvider } from "../../provider/providers/model/TestProvider.ts";
import { AgentService } from "./AgentService.ts";

describe("AgentService", () => {
	for (const tools of [false, true])
		it(
			tools
				? "consumes queued messages at the next tool loop"
				: "leaves late messages unconsumed when generation ends",
			async () => {
				const data: zData = [];
				const queued: zInterjectionPart[] = [];
				const config = zConfig.parse({
					provider: "test",
					model: "test-generate",
					toolsets: [],
				});
				let calls = 0;
				let sent = false;
				const run = AgentService.generate({
					provider: TestProvider,
					capabilities: {},
					toolsets: [],
					skills: [],
					data,
					metadata: [],
					env: {},
					instructions: "Test",
					context: {
						user: { id: "test", name: "test", settings: {}, isEphemeral: true },
						timezone: "UTC",
						interactive: true,
						messages: [
							{
								id: "prompt",
								author: "USER",
								config,
								createdAt: null,
								data: [
									[
										{
											id: "prompt",
											type: "text",
											value: tools ? "!bench tools 1" : "!bench text 1",
										},
									],
								],
							},
							{ id: "reply", author: "MODEL", config, createdAt: null, data },
						],
					},
					interjections: () => {
						calls++;
						return queued.splice(0);
					},
				});
				for await (const event of run) {
					if (event.type === "data" && !sent) {
						queued.push({
							id: "queued",
							type: "interjection",
							value: [
								{ id: "content", type: "text", value: "Please continue" },
							],
						});
						sent = true;
					}
				}
				expect(data.flat().filter((part) => part.type === "abort")).toEqual([]);
				if (tools) expect(calls).toBeGreaterThanOrEqual(2);
				else expect(calls).toBe(1);
				expect(data.flat().some((part) => part.type === "interjection")).toBe(
					tools,
				);
				expect(queued).toHaveLength(tools ? 0 : 1);
			},
		);
});
