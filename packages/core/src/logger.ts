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
	logToDisk,
	silent,
}: {
	logWriter?: LogWriter;
	logToDisk?: boolean;
	silent?: boolean;
} = {}) {
	if (!silent) console.log("setting up logs...");

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
						if (!silent && !existsSync(file))
							original("writing logs to:", file);

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
			if (!silent) original(...data);
			replaced(...data);
		};

		if (level === "error") {
			const globals = globalThis as any;

			if (
				typeof globals.window !== "undefined" &&
				typeof globals.window?.addEventListener === "function"
			) {
				console.log("logging to browser");
				globals.window?.addEventListener("error", (error: unknown) =>
					console.error("[UNCAUGHT]", error),
				);
				globals.window?.addEventListener(
					"unhandledrejection",
					(error: unknown) => console.error("[UNCAUGHT]", error),
				);
			}

			if (
				typeof globals.process !== "undefined" &&
				typeof globals.process.on === "function"
			) {
				console.log("logging to process");
				globals.process?.on("uncaughtException", (error: unknown) => {
					console.error("[UNCAUGHT]", error);
					globals.process.exit(1);
				});
				globals.process?.on(
					"unhandledRejection",
					(reason: unknown, promise: Promise<unknown>) => {
						console.error("[UNCAUGHT]", promise, reason);
					},
				);
			}
		}
	}
}
