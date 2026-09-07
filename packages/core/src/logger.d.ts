export declare const VERBOSE = false;
export declare const LogLevel: {
	readonly log: "log";
	readonly info: "info";
	readonly warn: "warn";
	readonly error: "error";
	readonly trace: "trace";
};
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
export type LogWriter = (
	time: string,
	level: LogLevel,
	...data: unknown[]
) => void;
export declare function createLogger({
	logWriter,
	logToDisk,
	silent,
}?: {
	logWriter?: LogWriter;
	logToDisk?: boolean;
	silent?: boolean;
}): void;
