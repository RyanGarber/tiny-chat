import type { IncomingMessage, ServerResponse } from "node:http";
import {
	type AntigravityAccount,
	createAntigravityProxyProvider,
} from "@ryangarber/ai-sdk-antigravity-proxy";
import type { Tool } from "ai";
import { streamText } from "ai";
import { z } from "zod";

/**
 * A thin wrapper around Antigravity Proxy, preventing CORS errors.
 */
export const AntigravityService = {
	handle: async (req: IncomingMessage, res: ServerResponse) => {
		const account = JSON.parse(
			req.headers["x-antigravity-account"] as string,
		) as AntigravityAccount;
		const body = await new Promise<string>((resolve, reject) => {
			let data = "";
			req.on("data", (chunk) => (data += chunk));
			req.on("end", () => resolve(data));
			req.on("error", reject);
		});
		const data = JSON.parse(body || "null");
		const abortController = new AbortController();
		req.on("close", () => abortController.abort());
		try {
			await AntigravityService.generate(
				data,
				account,
				res,
				abortController.signal,
			);
		} catch (error: any) {
			if (error.name === "AbortError") {
				return;
			}
			res.write(
				`data: ${JSON.stringify({ type: "error", error: JSON.stringify(error) })}\n\n`,
			);
		} finally {
			res.end();
		}
	},

	generate: async (
		data: any,
		account: AntigravityAccount,
		res: ServerResponse,
		abortSignal: AbortSignal,
	) => {
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Transfer-Encoding", "chunked");
		res.setHeader("X-Accel-Buffering", "no");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");

		console.log("received antigravity data:", data);

		const client = createAntigravityProxyProvider({ account });
		const stream = streamText({
			model: client.languageModel(data.model as string),
			prompt: data.prompt,
			tools: Object.fromEntries(
				data.tools.map((t: any) => [
					t.name,
					{
						description: t.description,
						inputSchema: z.fromJSONSchema(t.inputSchema as never),
					} satisfies Tool,
				]),
			),
			providerOptions: data.providerOptions,
			allowSystemInMessages: true,
			abortSignal,
		});

		for await (const event of stream.stream) {
			console.log("returning antigravity data:", event);
			res.write(`data: ${JSON.stringify(event)}\n\n`);
		}
	},
} as const;
