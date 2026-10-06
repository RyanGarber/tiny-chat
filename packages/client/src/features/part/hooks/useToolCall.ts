import { useMemo } from "react";
import { ToolStreamService } from "#client/core/services/StreamService.ts";
import { useStream } from "#client/features/agent/hooks/useStream.ts";
import { useMessageStore } from "#client/features/message/stores/useMessageStore.ts";
import { useToolFeedbackStore } from "#client/features/part/stores/useToolFeedbackStore.ts";
import type { RenderedPart } from "#core/features/data/utils/DataUtils.ts";
import type { ToolCallDisplay } from "#core/features/tool/types/display.ts";
import { ToolCallUtils } from "#core/features/tool/utils/ToolCallUtils.ts";

/**
 * Everything a runtime needs to draw one tool call: its status line, and the
 * input, output and controls it shows. Output streamed while the call runs is
 * folded into the same blocks its result is, so a renderer draws one thing
 * that fills in rather than switching between a live view and a final one.
 *
 * `interrupt` is there while the call runs: it kills it, and the model is
 * told to wait for the user before trying again.
 */
export const useToolCall = ({
	part,
}: {
	part: Extract<RenderedPart, { type: "toolCall" }>;
}): ToolCallDisplay & { interrupt?: () => void } => {
	const toolsets = useMessageStore((s) => s.toolsets);
	const stream = useStream<unknown>(part.id);
	// An answered call shows as running from the moment it is answered, not
	// only once it starts reporting.
	const answered = useToolFeedbackStore((s) => s.answered.has(part.id));

	const { id, name, input, result, validation, partial } = part;
	return useMemo(() => {
		const display = ToolCallUtils.getDisplay({
			part: {
				type: "toolCall",
				id,
				name,
				input,
				result,
				validation,
				partial,
			},
			toolsets,
			stream: stream?.items ?? (answered ? [] : undefined),
		});
		return {
			...display,
			interrupt:
				stream && display.state === "running"
					? () => ToolStreamService.abort(id)
					: undefined,
		};
	}, [
		id,
		name,
		input,
		result,
		validation,
		partial,
		toolsets,
		stream,
		answered,
	]);
};
