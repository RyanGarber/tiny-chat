import type {
	LanguageModelV4,
	LanguageModelV4StreamPart,
	ProviderV4,
} from "@ai-sdk/provider";
import type { ModelProvider } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";

export const TestProvider: ModelProvider<ProviderV4> = {
	name: "test",
	type: "model",
	settings: [],

	getSdk() {
		return createTestProvider();
	},

	getLanguageModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getSdkOptions() {
		return {};
	},

	async getStatus() {
		return {
			valid: true,
			models: [
				{
					name: "test-generate",
					features: ["language", "language:tools"],
					args: this.getModelArgs({ model: "test-generate" }),
				},
				{
					name: "test-embed",
					features: ["embedding"],
					args: this.getModelArgs({ model: "test-embed" }),
				},
			],
		};
	},

	getModelArgs() {
		return ModelProviderUtils.getModelArgs({ maxTemp: -1 });
	},
};

/**
 * Profiling harness. Send a message starting with `bench` to drive a
 * deterministic, heavy stream instead of the tiny default script:
 *
 *   bench text 800      – 800 words of markdown, one delta per word
 *   bench code 400      – markdown dominated by fenced code blocks
 *   bench table 300     – markdown dominated by GFM tables
 *   bench tools 6       – 6 tool calls with streamed input deltas
 *   bench thought 400   – reasoning deltas then text
 *   bench mixed 600     – reasoning + tools + text interleaved
 *
 * A trailing `~<ms>` overrides the inter-delta delay (default 10ms), e.g.
 * `bench text 800 ~0` to stream as fast as the event loop allows.
 * (`@` is avoided — it opens the editor's mention autocomplete.)
 */
interface Bench {
	kind: "text" | "code" | "table" | "tools" | "thought" | "mixed";
	count: number;
	delay: number;
}

const BENCH_RE =
	/\bbench(?:\s+(text|code|table|tools|thought|mixed))?(?:\s+(\d+))?(?:\s*[~](\d+))?/i;

function getBench(prompt: unknown): Bench | null {
	// Walk backwards for the most recent user text part.
	const messages = prompt as {
		role: string;
		content: string | { type: string; text?: string }[];
	}[];

	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "user") continue;

		const text =
			typeof message.content === "string"
				? message.content
				: message.content
						.filter((p) => p.type === "text")
						.map((p) => p.text ?? "")
						.join("\n");

		// The editor escapes markdown punctuation (`~` -> `\~`).
		const match = BENCH_RE.exec(text.replace(/\\/g, ""));
		if (!match) return null;

		return {
			kind: (match[1] as Bench["kind"]) ?? "text",
			count: match[2] ? Number(match[2]) : 400,
			delay: match[3] !== undefined ? Number(match[3]) : 10,
		};
	}
	return null;
}

const WORDS =
	`the quick brown fox jumps over a lazy dog while streaming tokens through the renderer pipeline and forcing a full markdown reparse on every single frame which is exactly what we want to measure here because incremental parsing is the difference between a smooth sixty frames per second and a janky slideshow when responses grow long`.split(
		" ",
	);

/** Deterministic markdown body of roughly `count` words. */
function buildMarkdown(kind: Bench["kind"], count: number): string {
	const out: string[] = [];
	let used = 0;
	let block = 0;

	while (used < count) {
		block++;
		if (kind === "code" && block % 2 === 0) {
			const lines: string[] = [];
			for (let i = 0; i < 12; i++) {
				lines.push(
					`  const value${i} = compute(${i}, "${WORDS[(used + i) % WORDS.length]}");`,
				);
				used += 6;
			}
			out.push(
				`\`\`\`ts\nfunction block${block}() {\n${lines.join("\n")}\n}\n\`\`\``,
			);
			continue;
		}

		if (kind === "table" && block % 2 === 0) {
			const rows: string[] = [
				"| id | name | status | notes |",
				"| --- | --- | --- | --- |",
			];
			for (let i = 0; i < 10; i++) {
				rows.push(
					`| ${i} | ${WORDS[(used + i) % WORDS.length]} | ok | ${WORDS[(used + i + 3) % WORDS.length]} |`,
				);
				used += 8;
			}
			out.push(rows.join("\n"));
			continue;
		}

		if (block % 4 === 1) {
			out.push(`## Section ${block}`);
			used += 2;
			continue;
		}

		if (block % 4 === 3) {
			const items: string[] = [];
			for (let i = 0; i < 5; i++) {
				const words = Array.from(
					{ length: 8 },
					(_, j) => WORDS[(used + i * 8 + j) % WORDS.length],
				);
				items.push(`- **${words[0]}** ${words.slice(1).join(" ")}`);
				used += 8;
			}
			out.push(items.join("\n"));
			continue;
		}

		const words = Array.from(
			{ length: 40 },
			(_, j) => WORDS[(used + j) % WORDS.length],
		);
		out.push(
			`${words.join(" ")}. Inline \`code\`, a [link](https://example.com), and *emphasis*.`,
		);
		used += 40;
	}

	return out.join("\n\n");
}

async function runBench({
	controller,
	bench,
	sleep,
	toolResult,
}: {
	controller: ReadableStreamDefaultController<LanguageModelV4StreamPart>;
	bench: Bench;
	sleep: (ms: number) => Promise<unknown>;
	toolResult: unknown;
}) {
	const { kind, count, delay } = bench;
	console.log("[TestProvider] bench", bench);

	const emitText = async (body: string) => {
		const id = `t${Math.random().toString(36).slice(2, 8)}`;
		controller.enqueue({ type: "text-start", id, providerMetadata: {} });

		// The envelope the agent parser expects.
		controller.enqueue({
			type: "text-delta",
			id,
			delta: `<message role="assistant" model="test-generate">\n`,
			providerMetadata: {},
		});

		// One delta per whitespace-delimited token, preserving separators.
		const tokens = body.match(/\s+|\S+/g) ?? [];
		for (const token of tokens) {
			controller.enqueue({
				type: "text-delta",
				id,
				delta: token,
				providerMetadata: {},
			});
			if (delay > 0) await sleep(delay);
		}

		controller.enqueue({
			type: "text-delta",
			id,
			delta: `\n</message>`,
			providerMetadata: {},
		});
		controller.enqueue({ type: "text-end", id, providerMetadata: {} });
	};

	const emitThought = async (words: number) => {
		const id = `r${Math.random().toString(36).slice(2, 8)}`;
		controller.enqueue({ type: "reasoning-start", id, providerMetadata: {} });
		for (let i = 0; i < words; i++) {
			controller.enqueue({
				type: "reasoning-delta",
				id,
				delta: `${WORDS[i % WORDS.length]} `,
				providerMetadata: {},
			});
			if (delay > 0) await sleep(delay);
		}
		controller.enqueue({ type: "reasoning-end", id, providerMetadata: {} });
	};

	const emitToolCall = async (n: number) => {
		const id = `call-${n}-${Math.random().toString(36).slice(2, 8)}`;
		const input = JSON.stringify({ path: `/mnt/uploads/dir-${n}` });

		controller.enqueue({
			type: "tool-input-start",
			id,
			toolName: "chat_read_dir",
			providerMetadata: {},
		});
		for (const ch of input) {
			controller.enqueue({
				type: "tool-input-delta",
				id,
				delta: ch,
				providerMetadata: {},
			});
			if (delay > 0) await sleep(delay);
		}
		controller.enqueue({ type: "tool-input-end", id, providerMetadata: {} });
		controller.enqueue({
			type: "tool-call",
			toolCallId: id,
			toolName: "chat_read_dir",
			input,
		});
	};

	if (kind === "tools") {
		// Each turn emits one batch; stop once results have come back.
		if (!toolResult) {
			for (let n = 0; n < count; n++) await emitToolCall(n);
		} else {
			await emitText(buildMarkdown("text", 60));
		}
		return;
	}

	if (kind === "thought") {
		await emitThought(count);
		await emitText(buildMarkdown("text", Math.max(60, count / 2)));
		return;
	}

	if (kind === "mixed") {
		if (!toolResult) {
			await emitThought(Math.round(count / 4));
			await emitText(buildMarkdown("text", Math.round(count / 4)));
			for (let n = 0; n < 3; n++) await emitToolCall(n);
		} else {
			await emitText(buildMarkdown("text", Math.round(count / 2)));
		}
		return;
	}

	await emitText(buildMarkdown(kind, count));
}

export function createTestProvider(): ProviderV4 {
	return {
		specificationVersion: "v4",
		languageModel(modelId: string): LanguageModelV4 {
			return {
				specificationVersion: "v4",
				provider: "test",
				modelId,
				supportedUrls: {},
				doGenerate() {
					throw new Error("Only streams are supported.");
				},
				async doStream(options) {
					const stream = new ReadableStream<LanguageModelV4StreamPart>({
						async start(controller) {
							const sleep = (ms: number) =>
								new Promise((resolve) => setTimeout(resolve, ms));

							controller.enqueue({
								type: "stream-start",
								warnings: [],
							});

							const data = options.prompt.slice(-1)[0].content;
							console.log("[TestProvider] last message:", data);

							if (typeof data === "string") throw new Error("Expected object");

							const toolResult = data.find((p) => p.type === "tool-result");
							const bench = getBench(options.prompt);

							if (bench) {
								await runBench({ controller, bench, sleep, toolResult });
							} else if (!toolResult) {
								await sleep(1000);
								controller.enqueue({
									type: "tool-call",
									toolCallId: "1",
									toolName: "chat_read_dir",
									input: JSON.stringify({
										path: "/mnt",
									}),
								});
							} else {
								await sleep(1000);
								controller.enqueue({
									type: "text-start",
									id: "1",
									providerMetadata: {},
								});
								await sleep(1000);

								controller.enqueue({
									type: "text-delta",
									id: "1",
									delta: `<message role="assistant" model="test-generate">\nDone! 🎉</message>`,
									providerMetadata: {},
								});
								await sleep(1000);

								controller.enqueue({
									type: "text-end",
									id: "1",
									providerMetadata: {},
								});
								await sleep(1000);
							}

							controller.enqueue({
								type: "finish",
								finishReason: { unified: "stop", raw: "stop" },
								usage: {
									inputTokens: {
										total: 0,
										noCache: 0,
										cacheRead: 0,
										cacheWrite: 0,
									},
									outputTokens: {
										total: 0,
										text: 0,
										reasoning: 0,
									},
								},
								providerMetadata: {},
							});
							controller.close();
						},
					});

					return {
						stream,
						rawCall: { rawPrompt: options.prompt, rawSettings: {} },
					};
				},
			};
		},
		embeddingModel() {
			throw new Error("Only language models are supported.");
		},
		imageModel() {
			throw new Error("Only language models are supported.");
		},
		rerankingModel() {
			throw new Error("Only language models are supported.");
		},
	};
}
