export const Level = {
	log: "log",
	info: "info",
	warn: "warn",
	error: "error",
	trace: "trace",
} as const;

export type Level = (typeof Level)[keyof typeof Level];

export type LogWrite = (time: string, level: Level, ...data: unknown[]) => void;

export function initLogs(write?: LogWrite, writeToDisk = false) {
	const levels = Object.values(Level);

	for (const level of levels) {
		const original = console[level].bind(console);

		const replaced = (...data: unknown[]) => {
			const time = new Date().toISOString().split("T")[1].split(".")[0];

			write?.(time, level, ...data);

			if (typeof process !== "undefined" && writeToDisk) {
				void (async () => {
					try {
						const { appendFile, existsSync, mkdirSync } = await import(
							/* @vite-ignore */ "node:fs"
						);
						const { resolve } = await import(/* @vite-ignore */ "node:path");
						const { tmpdir } = await import(/* @vite-ignore */ "node:os");
						const { inspect } = await import(/* @vite-ignore */ "node:util");

						const date = new Date().toISOString().split("T")[0];
						const file = resolve(tmpdir(), `tiny-chat/${date}.log`);
						mkdirSync(resolve(tmpdir(), "tiny-chat"), { recursive: true });
						if (!existsSync(file)) original("Logging to", file);

						data = data.map((d) => {
							return typeof d === "object" && d !== null ? inspect(d) : d;
						});

						appendFile(
							file,
							`[${time}] ${level.toUpperCase()}: ${data.join(" ")}\n`,
							(err) => {
								if (err) original("Failed to write to log file:", err);
							},
						);
					} catch (e) {
						original("Internal logger error:", e);
					}
				})();
			}
		};

		console[level] = (...data: unknown[]) => {
			original(...data);
			replaced(...data);
		};

		if (level === "error") {
			if (typeof window !== "undefined") {
				console.log("browser environment detected");
				window?.addEventListener("error", (e) =>
					console.error("[UNCAUGHT]", e),
				);
				window?.addEventListener("unhandledrejection", (e) =>
					console.error("[UNCAUGHT]", e),
				);
			}

			if (typeof process !== "undefined" && typeof process.on === "function") {
				console.log("node environment detected");
				process?.on("uncaughtException", (e) => {
					console.error("[UNCAUGHT]", e);
					process.exit(1);
				});
				process?.on("unhandledRejection", (reason, promise) => {
					console.error("[UNCAUGHT]", promise, reason);
				});
			}
		}
	}
}
