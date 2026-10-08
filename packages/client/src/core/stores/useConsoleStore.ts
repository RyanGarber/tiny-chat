import { create } from "zustand";
import type { LogLevel, LogWriter } from "#core/logger.ts";

/** The most recent lines kept, as the console lives in memory for the session. */
const MAX_LOGS = 1000;

export interface ConsoleLog {
	id: number;
	time: string;
	level: LogLevel;
	data: unknown[];
}

let nextId = 0;

/** Appends a line, dropping the oldest once there are more than `max`. */
export const appendLog = (
	logs: ConsoleLog[],
	log: Omit<ConsoleLog, "id">,
	max = MAX_LOGS,
) => {
	const next =
		logs.length >= max ? logs.slice(logs.length - max + 1) : [...logs];
	next.push({ id: nextId++, ...log });
	return next;
};

interface ConsoleStore {
	logs: ConsoleLog[];
	writer: LogWriter;
	clearLogs: () => void;
}

/**
 * Everything logged, for the console menu. Only an open menu subscribes, so a
 * log costs no render while it is closed.
 */
export const useConsoleStore = create<ConsoleStore>((set) => ({
	logs: [],
	writer: (time, level, ...data) =>
		set((state) => ({ logs: appendLog(state.logs, { time, level, data }) })),
	clearLogs: () => set({ logs: [] }),
}));
