import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";
import { TauriUtils } from "#gui/features/tauri/utils/TauriUtils.ts";

const MAX_ARG_LENGTH = 80;

/**
 * One line per message — its kind and size, never the payload. Payloads can be
 * megabytes (screenshots, file contents), and the console is kept in memory.
 */
const describe = (message: JSONRPCMessage, length: number) => {
	const kind =
		"method" in message
			? message.method
			: "error" in message
				? `error: ${message.error.message}`
				: "result";
	const id = "id" in message ? ` #${message.id}` : "";
	return `${kind}${id} (${length} chars)`;
};

export class TauriStdioTransport implements Transport {
	onmessage?: (message: JSONRPCMessage) => void;
	onerror?: (error: Error) => void;
	onclose?: () => void;

	private unlisten?: () => void;
	private unlistenLog?: () => void;

	constructor(
		private id: string,
		private command: string[],
		private env?: Record<string, string>,
		private onStderr?: (text: string) => void,
	) {}

	async start() {
		this.unlisten = await TauriUtils.listen<string>(
			`mcp-data:${this.id}`,
			(data) => {
				let message: JSONRPCMessage;
				try {
					message = JSON.parse(data) as JSONRPCMessage;
				} catch (e) {
					console.warn(`[mcp] ${this.id} sent a line that is not JSON`);
					this.onerror?.(e as Error);
					return;
				}
				console.log(
					`[mcp] ${this.id} received:`,
					describe(message, data.length),
				);
				this.onmessage?.(message);
			},
		);
		this.unlistenLog = await TauriUtils.listen<string>(
			`mcp-log:${this.id}`,
			(line) => {
				if (this.onStderr) this.onStderr(`${line}\n`);
				else console.warn(`[mcp] ${this.id}:`, line);
			},
		);

		// Env values are often credentials, and an argument can be a whole
		// script (the browser driver), so only their shape is logged.
		console.log(
			`[mcp] ${this.id} starting:`,
			this.command
				.map((arg) =>
					arg.length > MAX_ARG_LENGTH
						? `${arg.slice(0, MAX_ARG_LENGTH)}… (${arg.length} chars)`
						: arg,
				)
				.join(" "),
			Object.keys(this.env ?? {}).length
				? `env: ${Object.keys(this.env ?? {}).join(", ")}`
				: "",
		);
		await TauriUtils.invoke("mcp_start_stdio", {
			id: this.id,
			command: this.command,
			env: this.env ?? {},
		});
	}

	async send(message: JSONRPCMessage) {
		const data = JSON.stringify(message);
		console.log(`[mcp] ${this.id} sending:`, describe(message, data.length));
		await TauriUtils.invoke("mcp_send_stdio", { id: this.id, data });
	}

	async close() {
		console.log(`[mcp] ${this.id} closing`);
		this.unlisten?.();
		this.unlistenLog?.();
		await TauriUtils.invoke("mcp_stop_stdio", { id: this.id });
		this.onclose?.();
	}
}
