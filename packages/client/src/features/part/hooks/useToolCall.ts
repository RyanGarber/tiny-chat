import type { RenderedPart } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import type { ToolCallDisplay } from "@tiny-chat/core/features/tool/types/display.ts";
import { ToolCallUtils } from "@tiny-chat/core/features/tool/utils/ToolCallUtils.ts";
import { useMemo } from "react";
import { ToolStreamService } from "../../../core/services/StreamService.ts";
import { useStream } from "../../agent/hooks/useStream.ts";
import { useMessageStore } from "../../message/stores/useMessageStore.ts";

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
			stream: stream?.items,
		});
		return {
			...display,
			interrupt:
				stream && display.state === "running"
					? () => ToolStreamService.abort(id)
					: undefined,
		};
	}, [id, name, input, result, validation, partial, toolsets, stream]);
};
