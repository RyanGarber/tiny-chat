import { useThemes } from "@tiny-chat/client/features/settings/hooks/useThemes.ts";
import {
	type CodeRequest,
	type CodeResult,
	CodeUtils,
} from "@tiny-chat/core/core/utils/CodeUtils.ts";
import { useEffect, useMemo, useState } from "react";
import {
	type MarkdownHighlight,
	MarkdownUtils,
} from "../utils/MarkdownUtils.ts";

/**
 * Highlights the fenced blocks of code being written, off the main thread and
 * in the code theme the rest of the app draws its code in.
 *
 * A block that has changed keeps the last highlight it got until the worker
 * answers for what it holds now, and only then takes on the new one — so an
 * edit never sends it plain, even for a moment.
 */
export const useCodeHighlight = (value: string): MarkdownHighlight => {
	const { codeTheme } = useThemes();

	const blocks = useMemo(() => MarkdownUtils.codeBlocks(value), [value]);
	const requests = useMemo<CodeRequest[]>(
		() =>
			blocks.map(({ code, language }) => ({
				code,
				language,
				theme: codeTheme,
			})),
		[blocks, codeTheme],
	);

	// The last highlight each block got, by its place among the blocks.
	const [latest, setLatest] = useState<(CodeResult | undefined)[]>([]);

	useEffect(() => {
		const controller = new AbortController();

		for (const [index, request] of requests.entries()) {
			// A result the cache already holds resolves straight away.
			void CodeUtils.highlight(request, { signal: controller.signal }).then(
				(result) => {
					if (!result) return;
					setLatest((current) => {
						if (current[index] === result) return current;
						const next = [...current];
						next[index] = result;
						return next;
					});
				},
			);
		}

		// The next edit asks again, and a block it has moved past is dropped.
		return () => controller.abort();
	}, [requests]);

	return useMemo(() => {
		const results = new Map(
			requests.map((request, index) => [
				blocks[index].start,
				CodeUtils.peek(request) ?? latest[index] ?? null,
			]),
		);
		return (block) => results.get(block.start) ?? null;
	}, [blocks, requests, latest]);
};
