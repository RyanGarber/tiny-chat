/// <reference types="bun-types/ffi.d.ts" />

import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import library from "#cli/core/services/ComputerLibrary.ts";
import type { ClientComputer } from "#client/client.ts";

/**
 * The embedded library's path: absolute in a compiled binary (its own virtual
 * file system), relative to the bundle in `dist/`.
 */
const resolve = (library: string) =>
	isAbsolute(library)
		? library
		: fileURLToPath(new URL(library, import.meta.url));

const open = async (path: string): Promise<ClientComputer> => {
	const { CString, dlopen, FFIType, JSCallback } = await import("bun:ffi");

	const { symbols } = dlopen(path, {
		computer_call: {
			args: [FFIType.cstring, FFIType.pointer, FFIType.function],
			returns: FFIType.void,
		},
		computer_cancel: { args: [FFIType.i64], returns: FFIType.void },
		computer_string_free: { args: [FFIType.pointer], returns: FFIType.void },
	});

	const pending = new Map<number, (response: unknown) => void>();
	let next = 1;

	// Responses arrive from the library's worker thread, one per request, and
	// each string is ours to free.
	const onResponse = new JSCallback(
		(_context: number, pointer: number | null) => {
			if (!pointer) return;
			const json = new CString(pointer as never).toString();
			symbols.computer_string_free(pointer as never);
			const response = JSON.parse(json) as { id?: number };
			if (typeof response.id !== "number") return;
			pending.get(response.id)?.(response);
			pending.delete(response.id);
		},
		{
			args: [FFIType.pointer, FFIType.pointer],
			returns: FFIType.void,
			threadsafe: true,
		},
	);

	return {
		call: ({ method, params, abort }) =>
			new Promise((resolve, reject) => {
				if (abort?.aborted) return reject(abort.reason);
				const id = next++;
				const onAbort = () => {
					symbols.computer_cancel(id);
					pending.delete(id);
					reject(abort?.reason);
				};
				abort?.addEventListener("abort", onAbort, { once: true });
				pending.set(id, (response) => {
					abort?.removeEventListener("abort", onAbort);
					resolve(response);
				});
				symbols.computer_call(
					Buffer.from(`${JSON.stringify({ id, method, params })}\0`),
					null,
					onResponse.ptr,
				);
			}),
	};
};

let computer: ClientComputer | null | undefined;

export const ComputerBridgeService = {
	/**
	 * lib/computer, if it was built into the CLI and loads here. Opened on
	 * first use, since the toolset may never be.
	 */
	get: (): ClientComputer | undefined => {
		if (!library || !process.versions.bun) return undefined;
		return {
			call: async (request) => {
				if (computer === undefined) {
					try {
						computer = await open(resolve(library as string));
					} catch (error) {
						computer = null;
						throw error;
					}
				}
				if (!computer) throw new Error("lib/computer failed to load");
				return computer.call(request);
			},
		};
	},
};
