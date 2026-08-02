export const TerminalUtils = {
	/**
	 * Mouse tracking (see useScrollWheel) reports events on stdin, so whatever
	 * has focus reads them as text.
	 */
	// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal hell
	clean: (value: string) => value.replace(/\x1b?\[<(\d+);(\d+);(\d+)[Mm]/g, ""),
} as const;
