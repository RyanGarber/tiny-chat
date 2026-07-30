export const LogLevel = {
	log: "log",
	info: "info",
	warn: "warn",
	error: "error",
	trace: "trace",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogWriter = (
	time: string,
	level: LogLevel,
	...data: unknown[]
) => void;

export function createLogger({
	logWriter,
	logToDisk = true,
}: {
	logWriter?: LogWriter;
	logToDisk?: boolean;
} = {}) {
	console.log("injecting log handlers...");

	const levels = Object.values(LogLevel);

	for (const level of levels) {
		const original = console[level].bind(console);

		const replaced = (...data: unknown[]) => {
			const time = new Date().toISOString().split("T")[1].split(".")[0];

			logWriter?.(time, level, ...data);

			if (typeof process !== "undefined" && logToDisk) {
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
						if (!existsSync(file)) original("writing logs to:", file);

						data = data.map((d) => {
							return typeof d === "object" && d !== null ? inspect(d) : d;
						});

						appendFile(
							file,
							`[${time}] ${level.toUpperCase()}: ${data.join(" ")}\n`,
							(error) => {
								if (error) original("failed to write log:", error);
							},
						);
					} catch (error) {
						original("internal logging error:", error);
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
				console.log("detected browser, injecting logger into window");
				window?.addEventListener("error", (e) =>
					console.error("[UNCAUGHT]", e),
				);
				window?.addEventListener("unhandledrejection", (e) =>
					console.error("[UNCAUGHT]", e),
				);
			}

			if (typeof process !== "undefined" && typeof process.on === "function") {
				console.log("detected node, injecting logger into process");
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
