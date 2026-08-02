import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";

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
		this.unlisten = await TauriUtils.listen<string>(
			`mcp-data:${this.id}`,
			(data) => {
				console.log("[mcp] received message:", data);
				try {
					this.onmessage?.(JSON.parse(data) as JSONRPCMessage);
				} catch (e) {
					this.onerror?.(e as Error);
				}
			},
		);

		console.log("[mcp] starting stdio:", this.id, this.command, this.env);
		await TauriUtils.invoke("mcp_start_stdio", {
			id: this.id,
			command: this.command,
			env: this.env ?? {},
		});
	}

	async send(data: JSONRPCMessage) {
		console.log("[mcp] sending message:", data);
		await TauriUtils.invoke("mcp_send_stdio", {
			id: this.id,
			data: JSON.stringify(data),
		});
	}

	async close() {
		console.log("[mcp] closing transport:", this.id);
		this.unlisten?.();
		await TauriUtils.invoke("mcp_stop_stdio", { id: this.id });
		this.onclose?.();
	}
}
