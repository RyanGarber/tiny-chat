import { Box, Collapse } from "@mantine/core";
import { StackIcon } from "@phosphor-icons/react";
import { useMessageStore } from "#client/features/message/stores/useMessageStore.ts";
import { useAutoExpand } from "#client/features/part/hooks/useAutoExpand.ts";
import type { Compaction } from "#core/features/agent/services/AgentTokensService.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { RenderedPart } from "#core/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "#core/features/tool/utils/ToolCallUtils.ts";
import CompactionBadge from "#gui/features/message/components/CompactionBadge.tsx";
import Tail from "#gui/features/part/components/Tail.tsx";
import ToolCall from "#gui/features/part/components/ToolCall.tsx";
import ToolHeader from "#gui/features/part/components/ToolHeader.tsx";

/** Height the run is held to while it is open on its own. */
const TAIL_HEIGHT = 400;

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

	// A lone call is its own header.
	if (parts.length === 1)
		return (
			<div>
				<CompactionBadge compaction={compaction} id={parts[0].id} />
				<ToolCall
					message={message}
					part={parts[0]}
					isFocused={nextFeedbackId === parts[0].id}
					hold={hold}
				/>
			</div>
		);

	return (
		<Box my={10}>
			<ToolHeader
				icon={
					<StackIcon
						size={20}
						color="var(--mantine-color-dimmed)"
						className="shrink-0"
					/>
				}
				status={group.status}
				active={group.pending}
				expanded={expanded}
				onToggle={toggle}
			/>
			<Collapse expanded={expanded} keepMounted={false}>
				<Tail follow={auto} height={TAIL_HEIGHT} content={parts}>
					<Box pl="md" ml={9} mt={4}>
						{parts.map((part) => (
							<div key={part.id}>
								<CompactionBadge compaction={compaction} id={part.id} />
								<ToolCall
									message={message}
									part={part}
									isFocused={nextFeedbackId === part.id}
								/>
							</div>
						))}
					</Box>
				</Tail>
			</Collapse>
		</Box>
	);
}
