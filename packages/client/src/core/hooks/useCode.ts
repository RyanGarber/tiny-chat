import {
	type CodeRequest,
	type CodeResult,
	CodeUtils,
} from "@tiny-chat/core/core/utils/CodeUtils.ts";
import { useEffect, useMemo, useState } from "react";
import { useThemes } from "../../features/settings/hooks/useThemes.ts";

/**
 * Highlights code off the main thread. Renders straight away, plain or with
 * the lines that haven't changed since the last highlight, and swaps in the
 * worker's tokens when they arrive.
 *
 * @param incomplete The code is still streaming in. Its results aren't cached
 * 	until it finishes, since each is superseded by the next chunk.
 */
export const useCode = ({
	code,
	language,
	incomplete = false,
}: {
	code: CodeResult | string;
	language?: string | null;
	incomplete?: boolean;
}) => {
	const { codeTheme } = useThemes();

	const request = useMemo<CodeRequest | null>(
		() =>
			typeof code === "string"
				? { code, language: language ?? null, theme: codeTheme }
				: null,
		[code, language, codeTheme],
	);

	const [latest, setLatest] = useState<{
		request: CodeRequest;
		result: CodeResult;
	} | null>(null);

	useEffect(() => {
		if (!request || CodeUtils.peek(request)) return;

		if (latest?.request === request) {
			// a block that just finished keeps its last highlight
			if (!incomplete) {
				CodeUtils.store(CodeUtils.getCacheKey(request), latest.result);
			}
			return;
		}

		// a newer request (the next streamed chunk) or unmounting cancels this
		// one if the worker hasn't got to it yet, and a result for code the
		// block has moved past is dropped
		const controller = new AbortController();
		void CodeUtils.highlight(request, {
			signal: controller.signal,
			incomplete,
		}).then((result) => {
			if (result) setLatest({ request, result });
		});
		return () => controller.abort();
	}, [request, incomplete, latest]);

	const highlighted = useMemo(
		() =>
			typeof code === "string" && request
				? CodeUtils.placeholder(request, latest)
				: (code as CodeResult),
		[code, request, latest],
	);

	return { highlighted };
};

// grammars most chats need, loaded while the worker is otherwise idle
const COMMON_LANGUAGES = [
	"typescript",
	"tsx",
	"javascript",
	"python",
	"shellscript",
	"json",
];

/**
 * Starts the highlight worker and loads the code theme before the first code
 * block needs it. Mount once, near the root.
 */
export const usePrepareCode = () => {
	const { codeTheme } = useThemes();

	useEffect(() => {
		CodeUtils.prepare({ theme: codeTheme, languages: COMMON_LANGUAGES });
	}, [codeTheme]);
};
