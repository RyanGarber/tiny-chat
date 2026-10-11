/// <reference types="bun-types/ffi.d.ts" />

import type { AFMBridge, AFMEvent } from "#core/features/provider/types/afm.ts";

export const AFMLibraryService = {
	/**
	 * afmize's C ABI from its dynamic library at `path`, through Bun's FFI
	 * (the CLI's and the desktop app's main process both run on Bun). Throws on a
	 * macOS too old for FoundationModels, or a library missing its symbols.
	 */
	open: async (path: string): Promise<AFMBridge> => {
		const { CString, dlopen, FFIType, JSCallback } = await import("bun:ffi");

		const { symbols } = dlopen(path, {
			afmize_availability: { args: [], returns: FFIType.pointer },
			afmize_string_free: { args: [FFIType.pointer], returns: FFIType.void },
			afmize_stream_start: {
				args: [FFIType.cstring, FFIType.pointer, FFIType.function],
				returns: FFIType.i64,
			},
			afmize_stream_cancel: { args: [FFIType.i64], returns: FFIType.void },
		});

		// afmize hands each stream's context back with its events; here that is
		// a key to the listener, rather than a pointer to anything.
		const listeners = new Map<number, (event: AFMEvent) => void>();
		let next = 1;

		// Events arrive from afmize's own threads. Each string is ours to free,
		// and NULL follows the last.
		const onEvent = new JSCallback(
			(context: number, pointer: number | null) => {
				if (!pointer) {
					listeners.delete(context);
					return;
				}
				const json = new CString(pointer as never).toString();
				symbols.afmize_string_free(pointer as never);
				listeners.get(context)?.(JSON.parse(json));
			},
			{
				args: [FFIType.pointer, FFIType.pointer],
				returns: FFIType.void,
				threadsafe: true,
			},
		);

		return {
			availability: () => {
				const pointer = symbols.afmize_availability();
				if (!pointer) return "{}";
				const json = new CString(pointer).toString();
				symbols.afmize_string_free(pointer);
				return json;
			},
			stream: (request, listener) => {
				const context = next++;
				listeners.set(context, listener);
				const id = Number(
					symbols.afmize_stream_start(
						Buffer.from(`${JSON.stringify(request)}\0`),
						context as never,
						onEvent.ptr,
					),
				);
				// Rejected outright, so no events, and no NULL, will follow.
				if (id < 0) listeners.delete(context);
				return id;
			},
			cancel: (id) => {
				symbols.afmize_stream_cancel(id);
			},
		};
	},
} as const;
