import { PassThrough, Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { render as inkRender } from "ink";
import type { ReactNode } from "react";
import { afterEach } from "vitest";
import { StdinUtils } from "./StdinUtils.ts";

/** Exercise the same streams and framing as main.tsx, not an EventEmitter mock. */
export const createTestInput = (isTTY = true) =>
	Object.assign(new PassThrough(), {
		isTTY,
		isRaw: false,
		setRawMode(mode: boolean) {
			this.isRaw = mode;
			return this;
		},
		ref() {
			return this;
		},
		unref() {
			return this;
		},
	});

const createOutput = () => {
	const frames: string[] = [];
	const writes: string[] = [];
	return Object.assign(
		new Writable({
			write(chunk: Buffer, _encoding, callback) {
				const frame = chunk.toString();
				writes.push(frame);
				// Tracking/keyboard negotiation is terminal output, not a UI frame.
				if (!frame || stripVTControlCharacters(frame)) frames.push(frame);
				callback();
			},
		}),
		{
			columns: 100,
			rows: 24,
			isTTY: true,
			frames,
			writes,
			lastFrame: () => frames.at(-1),
		},
	);
};

const cleanups = new Set<() => void>();
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
});

export const render = (tree: ReactNode) => {
	const stdin = createTestInput();
	const filtered = StdinUtils.filter(stdin);
	const stdout = createOutput();
	const stderr = createOutput();
	const instance = inkRender(tree, {
		stdin: filtered,
		stdout,
		stderr,
		debug: true,
		exitOnCtrlC: false,
		patchConsole: false,
	});
	const cleanup = () => {
		instance.unmount();
		instance.cleanup();
		filtered.destroy();
		stdin.destroy();
		cleanups.delete(cleanup);
	};
	cleanups.add(cleanup);
	return {
		...instance,
		cleanup,
		stdin,
		filtered,
		stdout,
		stderr,
		frames: stdout.frames,
		lastFrame: stdout.lastFrame,
	};
};
