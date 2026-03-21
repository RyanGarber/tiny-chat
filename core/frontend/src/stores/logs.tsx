import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Level, LogWrite } from '@tiny-chat/core-backend/src/utils/logs.ts';

interface Logs {
  logs: { time: string; level: Level; data: unknown[] }[];
  writeLog: LogWrite;
  clearLogs: () => void;
}

export const useLogs = create(
  subscribeWithSelector<Logs>((set) => ({
    logs: [],
    writeLog: (time, level, ...data) =>
      set((state) => ({ logs: [...state.logs, { time, level, data }] })),
    clearLogs: () => set({ logs: [] }),
  })),
);
