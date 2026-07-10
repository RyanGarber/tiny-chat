import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { invoke, listen } from "#frontend/utils/api.ts";

export class TauriStdioTransport implements Transport {
	onmessage?: (message: JSONRPCMessage) => void;
	onerror?: (error: Error) => void;
	onclose?: () => void;

	private unlisten?: () => void;

	constructor(
		private id: string,
		private command: string[],
		private env?: Record<string, string>,
	) {}

	async start() {
		this.unlisten = await listen<string>(`mcp-data:${this.id}`, (data) => {
			console.log("Received message:", data);
			try {
				this.onmessage?.(JSON.parse(data) as JSONRPCMessage);
			} catch (e) {
				this.onerror?.(e as Error);
			}
		});

		console.log("Starting transport:", this.id, this.command, this.env);
		await invoke("mcp_start_stdio", {
			id: this.id,
			command: this.command,
			env: this.env ?? {},
		});
	}

	async send(data: JSONRPCMessage) {
		console.log("Sending message:", data);
		await invoke("mcp_send_stdio", {
			id: this.id,
			data: JSON.stringify(data),
		});
	}

	async close() {
		console.log("Closing transport:", this.id);
		this.unlisten?.();
		await invoke("mcp_stop_stdio", { id: this.id });
		this.onclose?.();
	}
}

export class TauriHttpTransport implements Transport {
	onmessage?: (message: JSONRPCMessage) => void;
	onerror?: (error: Error) => void;
	onclose?: () => void;

	private unlistenSseData?: () => void;
	private unlistenSseEnd?: () => void;
	private unlistenSseError?: () => void;

	sessionId: string | undefined = undefined;
	private sseBuffer = "";
	private sseId: string;
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
					console.log("[mcp] SSE message:", dataLine);
					try {
						this.onmessage?.(JSON.parse(dataLine) as JSONRPCMessage);
					} catch (e) {
						console.error("[mcp] JSON parse error:", e, "raw:", dataLine);
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
		this.unlistenSseData = await listen<string>(
			`mcp-data:${this.sseId}`,
			(data) => {
				console.log("[mcp:sse] data:", data);
				this.handleChunk(data);
			},
		);
		this.unlistenSseError = await listen<string>(
			`mcp-error:${this.sseId}`,
			(error) => {
				console.log("[mcp:sse] error:", error);
				this.onerror?.(new Error(error));
			},
		);
		this.unlistenSseEnd = await listen(`mcp-end:${this.sseId}`, () => {
			// SSE channel closed by server — that's a real disconnect
			console.log("[mcp:sse] end");
			this.onclose?.();
		});

		console.log("[mcp] starting SSE session:", this.sseId, this.url);
		await invoke("mcp_start_http", {
			id: this.sseId,
			url: this.url,
			headers: this.requestHeaders(),
		});
	}

	async send(message: JSONRPCMessage) {
		const postId = `${this.id}:post:${this.postCounter++}`;
		const body = new TextEncoder().encode(JSON.stringify(message));
		console.log("[mcp] sending:", message, "postId:", postId);

		// Listen for the response headers to capture mcp-session-id
		const unlistenResp = await listen<{
			status: number;
			headers: Record<string, string>;
		}>(`mcp-response:${postId}`, (response) => {
			console.log("[mcp:post] response meta:", response);
			const sid =
				response.headers["mcp-session-id"] ??
				response.headers["Mcp-Session-Id"];
			if (sid && !this.sessionId) {
				console.log("[mcp] captured session ID:", sid);
				this.sessionId = sid;
			}
		});

		// POST response data goes to postId — completely separate from sseId
		const unlistenData = await listen<string>(`mcp-data:${postId}`, (data) => {
			console.log("[mcp:post] data:", data);
			this.handleChunk(data);
		});

		const unlistenEnd = await listen(`mcp-end:${postId}`, () => {
			console.log("[mcp:post] end, postId:", postId);
			unlistenResp();
			unlistenData();
			unlistenEnd();
			// do NOT call onclose — only the SSE channel ending means disconnect
		});

		const unlistenError = await listen<string>(
			`mcp-error:${postId}`,
			(error) => {
				console.log("[mcp:post] error:", error);
				this.onerror?.(new Error(error));
				unlistenResp();
				unlistenData();
				unlistenEnd();
			},
		);

		try {
			// Register a new session for this POST, then immediately send
			await invoke("mcp_start_http", {
				id: postId,
				url: this.url,
				headers: this.requestHeaders(),
			});
			await invoke("mcp_send_http", {
				id: postId,
				method: "POST",
				extraPath: "",
				headers: this.requestHeaders(),
				body: Array.from(body),
			});
		} catch (e) {
			console.error("[mcp] send error:", e);
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
		await invoke("mcp_stop_http", { id: this.sseId }).catch(() => {
			// ignore
		});
		this.onclose?.();
	}
}
