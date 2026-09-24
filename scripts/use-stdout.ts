import * as readline from "node:readline";
import chalk, { type ChalkInstance } from "chalk";

type Level = "verbose" | "debug" | "info" | "warning" | "error";
const color: Record<Level, ChalkInstance> = {
	debug: chalk.dim,
	verbose: chalk.dim,
	info: chalk.blueBright,
	warning: chalk.yellowBright,
	error: chalk.redBright,
};

export function create(text: string) {
	let progress: number = -1;
	let tick = 0;
	let time: ReturnType<typeof performance.now> | undefined;
	let timeout: ReturnType<typeof setInterval> | undefined;

	const onTick = () => {
		const dotsFilled = 1 + (tick % 3);
		const dotsUnfilled = 3 - dotsFilled;

		let status = `${chalk.dim("::")} ${chalk.blueBright(text + ".".repeat(dotsFilled))}${" ".repeat(dotsUnfilled)}`;

		if (progress !== -1) {
			const width = process.stdout.columns ?? 80;

			const barStart = " [",
				barEnd = "] ";
			const bar = width - status.length - barStart.length - barEnd.length;
			const barFilled = Math.round(bar * progress);
			const barUnfilled = bar - barFilled;

			status += chalk.blueBright(
				barStart +
					"=".repeat(barFilled) +
					chalk.dim("-".repeat(barUnfilled)) +
					barEnd,
			);
		}
		if (tick === 0) process.stdout.write("\n");
		process.stdout.write(`\r\x1b[K${status}`, () => {});
		tick++;
	};

	const setProgress = (_progress: number | null) => {
		if (!timeout) time = performance.now();
		if (timeout) clearTimeout(timeout);
		if (_progress === null) return;
		progress = _progress;
		timeout = setInterval(onTick, 500);
		onTick();
	};

	setProgress(progress);

	return (_progress: string | number, level?: Level) => {
		if (typeof _progress === "string") {
			setProgress(null);
			let status = `${_progress}`;
			if (time) {
				status += ` · ${Math.round(performance.now() - time)}ms`;
			}
			process.stdout.write(
				`\r\x1b[K${chalk.dim("::")} ${color[level ?? "info"](status)}\n`,
				() => {},
			);
		} else {
			setProgress(_progress);
		}
	};
}

export function printout({
	stdout,
	stderr,
}: {
	stdout: string;
	stderr: string;
}) {
	print({ message: "stdout", details: stdout, level: "verbose" });
	print({ message: "stderr", details: stderr, level: "verbose" });
}

export function print({
	message,
	details,
	level,
}: {
	message?: string;
	details?: unknown;
	level?: Level;
}) {
	if (message !== undefined) {
		console.log(`\n${chalk.dim("::")} ${color[level ?? "info"](message)}`);
	}
	if (details !== undefined) {
		const parts = Array.isArray(details) ? details : [details];
		for (const part of parts) {
			console.log(
				typeof part === "string" || typeof part === "number"
					? chalk.dim(part)
					: part,
			);
		}
	}
}

type ExitHandler = (isCtrlD: boolean) => boolean;
let exitHandler: ExitHandler | undefined;

export function setExitHandler(value: ExitHandler) {
	setupTerminal();
	exitHandler = value;
}

export function setPassthrough(value: boolean) {
	process.stdin.setRawMode?.(!value);
	if (value) process.stdin.pause();
	else process.stdin.resume();
}

let terminalConfigured = false;

// Logging alone must not take over stdin or bypass a caller's signal cleanup.
// Only the interactive CLI opts into raw key handling via setExitHandler.
function setupTerminal() {
	if (!process.stdin.isTTY || terminalConfigured) return;
	terminalConfigured = true;
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdout.write(`\u001B[?25l`, () => {});
	const cleanup = ({ code }: { code: number }) => {
		print({ message: `stopping...`, details: code });
		process.stdout.write(`\u001B[?25h`, () => {});
	};
	process.on("exit", (code) => cleanup({ code }));
	process.on("uncaughtException", (data) => {
		print({ message: "uncaught exception", details: data, level: "error" });
		process.exit(1);
	});
	process.on("unhandledRejection", (data) => {
		print({ message: "unhandled rejection", details: data, level: "error" });
		process.exit(1);
	});
	process.on("SIGINT", () => {
		print({ message: "interrupted", level: "error" });
		process.exit(1);
	});
	process.stdin.on("keypress", (_input: string, key?: readline.Key) => {
		if (key?.ctrl && (key?.name === "c" || key?.name === "d")) {
			if (!exitHandler?.(key.name === "d")) {
				process.exit(0);
			}
		}
	});
}
