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

    const replaced = (...data: unknown[]) => {
      const time = new Date().toISOString().split('T')[1].split('.')[0];

      write?.(time, level, ...data);

      if (writeToDisk) {
        void (async () => {
          const { appendFile, existsSync, mkdirSync } = await import('fs');
          const { resolve } = await import('path');
          const { tmpdir } = await import('os');
          const { inspect } = await import('util');

          const date = new Date().toISOString().split('T')[0];
          const file = resolve(tmpdir(), `tiny-chat/${date}.log`);
          mkdirSync(resolve(tmpdir(), 'tiny-chat'), { recursive: true });
          if (!existsSync(file)) original('Logging to', file);

          data = data.map((d) => {
            return typeof d === 'object' && d !== null ? inspect(d) : d;
          });

          appendFile(file, `[${time}] ${level.toUpperCase()}: ${data.join(' ')}\n`, (err) => {
            if (err) original('Failed to write to log file:', err);
          });
        })();
      }
    };

    console[level] = (...data: unknown[]) => {
      original(...data);
      replaced(...data);
    };

    if (level === 'error') {
      if (typeof window !== 'undefined') {
        window?.addEventListener('error', (e) => replaced('Uncaught error:', e));
        window?.addEventListener('unhandledrejection', (e) =>
          replaced('Uncaught rejection:', e.reason),
        );
      }

      if (typeof process !== 'undefined') {
        process?.on('uncaughtException', (e) => replaced('Uncaught exception:', e));
      }
    }
  }
}
