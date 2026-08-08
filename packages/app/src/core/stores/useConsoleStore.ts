import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { LogLevel, LogWriter } from "#core/logger.ts";

interface ConsoleStore {
	logs: { id: number; time: string; level: LogLevel; data: unknown[] }[];
	writer: LogWriter;
	clearLogs: () => void;
}

export const useConsoleStore = create(
	subscribeWithSelector<ConsoleStore>((set) => ({
		logs: [],
		writer: (time, level, ...data) =>
			set((state) => ({
				logs: [...state.logs, { id: Math.random(), time, level, data }],
			})),
		clearLogs: () => set({ logs: [] }),
	})),
);
