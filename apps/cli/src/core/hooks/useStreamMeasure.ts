import { StreamService } from "@tiny-chat/client/src/features/chat/services/StreamService.ts";
import type { ScrollViewRef } from "ink-scroll-view";
import { type RefObject, useEffect } from "react";

/**
 * Keeps the measured height of a streaming message honest.
 *
 * A streaming message re-renders from the stream registry, underneath the
 * ScrollView, so the view itself never re-renders and never re-measures the
 * item. The content height then stays stuck at whatever the message was worth
 * when the stream started: autoscroll stops following it and the rows past that
 * height sit outside the scrollable range until the message finalises and the
 * list re-renders. Measuring the streaming item on every apply keeps the height
 * in step with what is actually on screen.
 */
export function useStreamMeasure({
	scrollRef,
	chatId,
	getIndex,
}: {
	scrollRef: RefObject<ScrollViewRef | null>;
	chatId: string | undefined;
	/** Position of the streaming message among the ScrollView's children */
	getIndex: (messageId: string) => number;
}) {
	useEffect(() => {
		if (!chatId) return;

		let unsubscribeStream: (() => void) | undefined;

		// The stream for a chat comes and goes, so re-attach whenever the set of
		// active streams changes.
		const attach = () => {
			unsubscribeStream?.();
			unsubscribeStream = undefined;

			const stream = StreamService.getChat(chatId);
			if (!stream) return;

			unsubscribeStream = stream.subscribe(() => {
				const index = getIndex(stream.id);
				if (index < 0) return;
				scrollRef.current?.remeasureItem(index);
			});
		};

		attach();
		const unsubscribeRegistry = StreamService.subscribe(attach);

		return () => {
			unsubscribeRegistry();
			unsubscribeStream?.();
		};
	}, [chatId, scrollRef, getIndex]);
}
