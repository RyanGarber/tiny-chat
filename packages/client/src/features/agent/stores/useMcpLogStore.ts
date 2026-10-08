import { create } from "zustand";
import {
	appendLog,
	type ConsoleLog,
} from "#client/core/stores/useConsoleStore.ts";
import type { LogLevel } from "#core/logger.ts";

/** Lines kept per server. */
const MAX_LOGS = 500;

const EMPTY: ConsoleLog[] = [];

interface McpLogStore {
	/** By server name: its connection attempts and whatever it wrote to stderr. */
	logs: Record<string, ConsoleLog[]>;
	write: (name: string, level: LogLevel, text: string) => void;
	clearLogs: (name: string) => void;
}

/**
 * Each MCP server's output, kept here rather than printed: a stdio server
 * writing straight to the terminal would tear through the CLI's rendering.
 * Only an open server editor subscribes.
 */
export const useMcpLogStore = create<McpLogStore>((set) => ({
	logs: {},
	write: (name, level, text) => {
		// A chunk of stderr can hold several lines, or end partway through one.
		const lines = text.split(/\r?\n/).filter((line) => line.trim());
		if (!lines.length) return;
		const time = new Date().toISOString().split("T")[1].split(".")[0];
		set((state) => {
			let logs = state.logs[name] ?? EMPTY;
			for (const line of lines) {
				logs = appendLog(logs, { time, level, data: [line] }, MAX_LOGS);
			}
			return { logs: { ...state.logs, [name]: logs } };
		});
	},
	clearLogs: (name) =>
		set((state) => {
			const logs = { ...state.logs };
			delete logs[name];
			return { logs };
		}),
}));

export const selectMcpLogs = (name: string) => (state: McpLogStore) =>
	state.logs[name] ?? EMPTY;
