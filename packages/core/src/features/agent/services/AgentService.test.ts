import { zConfig } from "../../data/types/message.ts";
import type {
	zData,
	zInterjectionPart,
	zToolCallPart,
} from "../../data/types/part.ts";
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

	const run = (prompt: string, abortSignal?: AbortSignal) => {
		const data: zData = [];
		const config = zConfig.parse({
			provider: "test",
			model: "test-generate",
			toolsets: [],
		});
		return {
			data,
			events: AgentService.generate({
				provider: TestProvider,
				capabilities: {},
				toolsets: [],
				skills: [],
				data,
				metadata: [],
				env: {},
				instructions: "<chat>/mnt/chat/123/</chat>",
				options: { abortSignal },
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
							data: [[{ id: "prompt", type: "text", value: prompt }]],
						},
						{ id: "reply", author: "MODEL", config, createdAt: null, data },
					],
				},
			}),
		};
	};

	it("streams a tool call's input before the call is complete", async () => {
		// Paced like a real model, so the input is parsed between tokens.
		const { data, events } = run("!bench tools 1 ~5");
		const seen: unknown[] = [];
		for await (const event of events) {
			if (event.type !== "toolInput") continue;
			const part = data.flat().find((part) => part.type === "toolCall");
			if (part?.type === "toolCall" && part.partial) seen.push(part.input);
		}

		// The input is readable while it is still being written.
		expect(seen.length).toBeGreaterThan(1);
		expect(seen.some((input) => !!(input as { path?: string }).path)).toBe(
			true,
		);
		for (const input of seen) {
			const path = (input as { path?: string }).path;
			if (path !== undefined)
				expect("/mnt/chat/123/").toContain(
					path.slice(0, "/mnt/chat/123/".length),
				);
		}

		// It settles into one complete call, in the place it streamed into.
		const calls = data
			.flat()
			.filter(
				(part): part is zToolCallPart =>
					part.type === "toolCall" && part.name === "read_dir",
			);
		expect(calls).toHaveLength(1);
		expect(calls[0]).not.toHaveProperty("partial");
		expect(calls[0].input).toEqual({ path: "/mnt/chat/123/" });
	});

	it("drops a tool call the model never finished writing", async () => {
		const abort = new AbortController();
		const { data, events } = run("!bench tools 1 ~5", abort.signal);
		let started = false;
		for await (const event of events) {
			if (event.type === "toolInput" && event.delta && !started) {
				started = true;
				abort.abort();
			}
		}

		expect(started).toBe(true);
		expect(data.flat().filter((part) => part.type === "toolCall")).toEqual([]);
		expect(data.flat().some((part) => part.type === "abort")).toBe(true);
	});
});
