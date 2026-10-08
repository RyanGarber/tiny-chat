/** The CLI's handling of what is written to its own stderr. */
export const StderrUtils = {
	/**
	 * Sends writes to `process.stderr` (runtime warnings, libraries that skip
	 * the console) to the console instead, which is silent and kept for
	 * `/console`: printed, they would land in the middle of the UI and desync
	 * Ink's incremental rendering. Returns the function that undoes it.
	 */
	capture: () => {
		const write = process.stderr.write;

		process.stderr.write = ((
			chunk: string | Uint8Array,
			encoding?: BufferEncoding | ((error?: Error | null) => void),
			callback?: (error?: Error | null) => void,
		) => {
			const text =
				typeof chunk === "string"
					? chunk
					: Buffer.from(chunk).toString(
							typeof encoding === "string" ? encoding : "utf8",
						);
			if (text.trim()) console.warn(text.trimEnd());
			(typeof encoding === "function" ? encoding : callback)?.();
			return true;
		}) as typeof process.stderr.write;

		return () => {
			process.stderr.write = write;
		};
	},
} as const;
