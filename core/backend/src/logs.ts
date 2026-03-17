export const Level = {
  log: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
  trace: 'trace',
} as const;

export type Level = (typeof Level)[keyof typeof Level];

export type LogWrite = (time: string, level: Level, ...data: unknown[]) => void;

export function initLogs(write?: LogWrite, writeToDisk = false) {
  const levels = Object.values(Level);

  for (const level of levels) {
    const original = console[level].bind(console);

    console[level] = (...data: unknown[]) => {
      const time = new Date().toISOString().split('T')[1].split('.')[0];

      original(...data);
      write?.(time, level, ...data);

      if (writeToDisk) {
        void (async () => {
          const { appendFile, existsSync } = await import('fs');
          const { resolve } = await import('path');
          const { tmpdir } = await import('os');

          const date = new Date().toISOString().split('T')[0];
          const file = resolve(tmpdir(), `${date}.tiny-chat.log`);
          if (!existsSync(file)) console.log('Logging to', file);

          data = data.map((d) => {
            return typeof d === 'object' && d !== null ? JSON.stringify(d) : d;
          });

          appendFile(file, `[${time}] ${level.toUpperCase()}: ${data.join(' ')}\n`, (err) => {
            if (err) original('Failed to write to log file:', err);
          });
        })();
      }
    };
  }
}
