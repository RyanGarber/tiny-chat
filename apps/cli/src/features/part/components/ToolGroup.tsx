import { useMessageStore } from "@tiny-chat/client/features/message/stores/useMessageStore.ts";
import { useAutoExpand } from "@tiny-chat/client/features/part/hooks/useAutoExpand.ts";
import type { Compaction } from "@tiny-chat/core/features/agent/services/AgentTokensService.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/features/tool/utils/ToolCallUtils.ts";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import ScrollTail from "./ScrollTail.tsx";
import Task from "./Task.tsx";
import ToolCall, { toStatusParts } from "./ToolCall.tsx";

const DETAILS_PROPS = { paddingY: 1, backgroundColor: "surface" } as const;

function CompactionBadge({
	compaction,
	id,
}: {
	compaction?: Compaction;
	id?: string;
}) {
	const status = id ? compaction?.get(id) : undefined;
	return status ? <Text color="yellow">[{status}]</Text> : null;
}

/**
 * A run of consecutive tool calls. While any of it is moving, and until
 * something other than another call follows it, the run stays open so each
 * call can be watched as it goes; then it folds into one line counting what
 * was done.
 */
export default function ToolGroup({
	message,
	parts,
	compaction,
	hold,
}: {
	message?: MessageState;
	parts: Extract<RenderedPart, { type: "toolCall" }>[];
	compaction?: Compaction;
	/** Keeps it open after it settles, until something follows it. */
	hold?: boolean;
}) {
	const toolsets = useMessageStore((s) => s.toolsets);
	const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);

	const group = ToolCallUtils.getGroup({ parts, toolsets });
	const { expanded, auto, toggle } = useAutoExpand(group.pending || !!hold);

	const items = parts.map((part) => (
		<Box key={part.id} flexDirection="column">
			<CompactionBadge compaction={compaction} id={part.id} />
			<ToolCall
				message={message}
				part={part}
				isFocused={part.id === nextFeedbackId}
				hold={parts.length === 1 ? hold : undefined}
			/>
		</Box>
	));

	return (
		<Task.Group detailsProps={DETAILS_PROPS}>
			{parts.length === 1 ? (
				// A lone call is its own header.
				items[0]
			) : (
				<Task expanded={expanded} onToggle={toggle}>
					<Task.Status
						status={group.pending ? "pending" : "success"}
						emoji="🧰"
						parts={toStatusParts(group.status)}
					/>
					<Task.Details
						paddingY={0}
						paddingLeft={0}
						backgroundColor={undefined}
					>
						<ScrollTail follow={auto}>
							<Box flexDirection="column" gap={1} marginTop={1}>
								{items}
							</Box>
						</ScrollTail>
					</Task.Details>
				</Task>
			)}
		</Task.Group>
	);
}
