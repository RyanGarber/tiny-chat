import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Level, LogWrite } from "#shared/logs.ts";

interface LogStore {
	logs: { id: number; time: string; level: Level; data: unknown[] }[];
	writeLog: LogWrite;
	clearLogs: () => void;
}

export const useLogStore = create(
	subscribeWithSelector<LogStore>((set) => ({
		logs: [],
		writeLog: (time, level, ...data) =>
			set((state) => ({
				logs: [...state.logs, { id: Math.random(), time, level, data }],
			})),
		clearLogs: () => set({ logs: [] }),
	})),
);
