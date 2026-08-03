import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

export class TauriHttpTransport implements Transport {
	onmessage?: (message: JSONRPCMessage) => void;
	onerror?: (error: Error) => void;
	onclose?: () => void;

	private unlistenSseData?: () => void;
	private unlistenSseEnd?: () => void;
	private unlistenSseError?: () => void;

	sessionId: string | undefined = undefined;
	private sseBuffer = "";
	private readonly sseId: string;
	private postCounter = 0;

	constructor(
		private id: string,
		private url: string,
		private headers: Record<string, string> = {},
	) {
		this.sseId = `${id}:sse`;
	}

	private handleChunk(chunk: string) {
		this.sseBuffer += chunk;
		// Split on \n, handle both \r\n and \n line endings
		const lines = this.sseBuffer.split("\n");
		this.sseBuffer = lines.pop() ?? "";

		let dataLine: string | null = null;

		for (const raw of lines) {
			const line = raw.trimEnd(); // strips \r and trailing spaces

			if (line.startsWith("data:")) {
				dataLine = line.slice("data:".length).trimStart();
			} else if (line === "") {
				// end of event
				if (dataLine !== null && dataLine !== "") {
					try {
						this.onmessage?.(JSON.parse(dataLine) as JSONRPCMessage);
					} catch (e) {
						console.error("[mcp] json parse error:", e, "raw:", dataLine);
						this.onerror?.(e as Error);
					}
				}
				dataLine = null;
			}
			// event:, id:, retry: — intentionally ignored
		}
	}

	private requestHeaders(): Record<string, string> {
		return {
			...this.headers,
			Accept: "application/json, text/event-stream",
			"Content-Type": "application/json",
			...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
		};
	}

	async start() {
		// SSE channel listeners — keyed to sseId, never torn down until close()
		this.unlistenSseData = await TauriUtils.listen<string>(
			`mcp-data:${this.sseId}`,
			(data) => {
				this.handleChunk(data);
			},
		);
		this.unlistenSseError = await TauriUtils.listen<string>(
			`mcp-error:${this.sseId}`,
			(error) => {
				console.log("[mcp] sse error:", error);
				this.onerror?.(new Error(error));
			},
		);
		this.unlistenSseEnd = await TauriUtils.listen(
			`mcp-end:${this.sseId}`,
			() => {
				// SSE channel closed by server — that's a real disconnect
				this.onclose?.();
			},
		);

		console.log("[mcp] starting http:", this.sseId, this.url);
		await TauriUtils.invoke("mcp_start_http", {
			id: this.sseId,
			url: this.url,
			headers: this.requestHeaders(),
		});
	}

	async send(message: JSONRPCMessage) {
		const postId = `${this.id}:post:${this.postCounter++}`;
		const body = new TextEncoder().encode(JSON.stringify(message));

		// Listen for the response headers to capture mcp-session-id
		const unlistenResp = await TauriUtils.listen<{
			status: number;
			headers: Record<string, string>;
		}>(`mcp-response:${postId}`, (response) => {
			const sid =
				response.headers["mcp-session-id"] ??
				response.headers["Mcp-Session-Id"];
			if (sid && !this.sessionId) {
				this.sessionId = sid;
			}
		});

		// POST response data goes to postId — completely separate from sseId
		const unlistenData = await TauriUtils.listen<string>(
			`mcp-data:${postId}`,
			(data) => {
				this.handleChunk(data);
			},
		);

		const unlistenEnd = await TauriUtils.listen(`mcp-end:${postId}`, () => {
			unlistenResp();
			unlistenData();
			unlistenEnd();
			// do NOT call onclose — only the SSE channel ending means disconnect
		});

		const unlistenError = await TauriUtils.listen<string>(
			`mcp-error:${postId}`,
			(error) => {
				console.log("[mcp] error in streamable-http:", error);
				this.onerror?.(new Error(error));
				unlistenResp();
				unlistenData();
				unlistenEnd();
			},
		);

		try {
			// Register a new session for this POST, then immediately send
			await TauriUtils.invoke("mcp_start_http", {
				id: postId,
				url: this.url,
				headers: this.requestHeaders(),
			});
			await TauriUtils.invoke("mcp_send_http", {
				id: postId,
				method: "POST",
				extraPath: "",
				headers: this.requestHeaders(),
				body: Array.from(body),
			});
		} catch (e) {
			console.error("[mcp] failed to send:", e);
			unlistenResp();
			unlistenData();
			unlistenEnd();
			unlistenError();
			this.onerror?.(e as Error);
		}
	}

	async close() {
		console.log("[mcp] closing:", this.id);
		this.unlistenSseData?.();
		this.unlistenSseEnd?.();
		this.unlistenSseError?.();
		await TauriUtils.invoke("mcp_stop_http", { id: this.sseId }).catch(() => {
			// ignore
		});
		this.onclose?.();
	}
}
