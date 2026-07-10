import { type HighlightResult, code as StreamdownCode } from "@streamdown/code";
import type { Author } from "@tiny-chat/backend/generated/prisma/enums.ts";
import { useEffect, useRef, useState } from "react";
import type { BundledLanguage, BundledTheme } from "streamdown";
import { trpc } from "#frontend/utils/api.ts";
import type { zConfig } from "#shared/types/chat.ts";

export function useViewport() {
	const [height, setHeight] = useState(
		window.visualViewport?.height ?? window.innerHeight,
	);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		let frameId: number;

		const onUpdate = () => {
			cancelAnimationFrame(frameId);
			frameId = requestAnimationFrame(() => {
				setHeight(vv.height);
				if (containerRef.current)
					containerRef.current.style.transform = `translateY(${vv.offsetTop}px)`;
			});
		};

		// Immediately set initial values
		onUpdate();

		vv.addEventListener("resize", onUpdate);
		vv.addEventListener("scroll", onUpdate);
		return () => {
			cancelAnimationFrame(frameId);
			vv.removeEventListener("resize", onUpdate);
			vv.removeEventListener("scroll", onUpdate);
		};
	}, []);

	return { height, containerRef };
}

export async function importChat(
	messages: {
		author: Author;
		reasoning?: string | undefined;
		text?: string | undefined;
	}[],
	config: zConfig,
) {
	let chatId: string | undefined;
	for (const message of messages) {
		const created = await trpc.message.create.mutate({
			chatId,
			config,
			author: message.author,
			data: [
				[
					...(message.reasoning?.length
						? [{ type: "thought" as const, value: message.reasoning }]
						: []),
					...(message.text?.length
						? [{ type: "text" as const, value: message.text }]
						: []),
				],
			],
			metadata: [],
		});
		console.log(`created ${created.id} in chat ${chatId}`);
		chatId ??= created.chatId;
	}
}

const highlightCache: Record<string, HighlightResult> = {};

export const unhighlight = (code: string): HighlightResult => {
	return {
		bg: "transparent",
		fg: "inherit",
		tokens: code.split("\n").map((line) => [
			{
				content: line,
				color: "inherit",
				bgColor: "transparent",
				htmlStyle: {},
				offset: 0,
			},
		]),
	};
};

/**
 * Highlights `code` using Streamdown's Shiki-backed highlighter.
 *
 * Shiki loads languages/themes lazily, so a brand-new (language, theme, code)
 * combination is highlighted asynchronously: this function returns a plain
 * (unhighlighted) placeholder immediately, and - if `onReady` is provided -
 * invokes it once with the real result as soon as it's available. `onReady`
 * is called synchronously (before this function returns) when the result is
 * already known (cached, or the language isn't supported).
 */
export const highlight = (
	language: string,
	codeTheme: string,
	code: string,
	onReady?: (result: HighlightResult) => void,
): HighlightResult => {
	if (!StreamdownCode.supportsLanguage(language as BundledLanguage)) {
		const result = unhighlight(code);
		onReady?.(result);
		return result;
	}

	const cacheKey = `${language}-${codeTheme}-${code.trim()}`;
	const cached = highlightCache[cacheKey];
	if (cached) {
		onReady?.(cached);
		return cached;
	}

	const result = StreamdownCode.highlight(
		{
			code,
			language: language as BundledLanguage,
			themes: [codeTheme as BundledTheme, codeTheme as BundledTheme],
		},
		(asyncResult) => {
			// Only cache the genuine result - never the placeholder below, or
			// this key would be stuck returning unhighlighted code forever.
			highlightCache[cacheKey] = asyncResult;
			onReady?.(asyncResult);
		},
	);

	if (!result) return unhighlight(code);

	highlightCache[cacheKey] = result;
	onReady?.(result);
	return result;
};

export const toCSSProperties = (rootStyle: string): Record<string, string> => {
	const style: Record<string, string> = {};
	for (const decl of rootStyle.split(";")) {
		const idx = decl.indexOf(":");
		if (idx > 0) {
			const prop = decl.slice(0, idx).trim();
			const val = decl.slice(idx + 1).trim();
			if (prop && val) {
				style[prop] = val;
			}
		}
	}
	return style;
};
