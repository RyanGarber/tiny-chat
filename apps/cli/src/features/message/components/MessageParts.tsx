import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import type { Compaction } from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import type {
	MessageState,
	zData,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import Task from "../../part/components/Task.tsx";
import Thought from "../../part/components/Thought.tsx";
import ToolCall from "../../part/components/ToolCall.tsx";
import Markdown from "./Markdown.tsx";

/* biome-ignore-start lint/suspicious/noArrayIndexKey: parts stay in order */
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

export default function MessageParts({
	message,
	data,
	status,
	compaction,
}: {
	message?: MessageState;
	data: zData;
	status?: AgentStreamEvent["status"];
	compaction?: Compaction;
}) {
	const toolsets = useMessageStore((s) => s.toolsets);
	const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);

	const parts = DataUtils.getRenderedPartsGrouped(
		data,
		status === "thinking",
		"thought",
		"toolCall",
	);

	return parts.flatMap((part, index) => {
		if (part.type === "group") {
			return (
				<Task.Group
					key={index}
					detailsProps={{
						paddingY: 1,
						backgroundColor: "surface",
					}}
				>
					{part.value.flatMap((part, index, parts) => {
						if (part.type === "thought") {
							if (parts[index - 1]?.type === "thought") return [];
							const nextNonThought = parts
								.slice(index)
								.findIndex((candidate) => candidate.type !== "thought");
							const thoughts = parts
								.slice(
									index,
									nextNonThought === -1 ? undefined : index + nextNonThought,
								)
								.filter(
									(candidate): candidate is typeof part =>
										candidate.type === "thought",
								);
							return (
								<Box key={index} flexDirection="column">
									<CompactionBadge
										compaction={compaction}
										id={
											thoughts.find(
												(thought) => thought.id && compaction?.has(thought.id),
											)?.id
										}
									/>
									<Thought thoughts={thoughts} />
								</Box>
							);
						} else if (part.type === "toolCall") {
							const display = ToolCallUtils.getDisplay({
								part,
								toolsets,
							});
							return (
								<Box key={index} flexDirection="column">
									<CompactionBadge compaction={compaction} id={part.id} />
									<ToolCall
										message={message}
										part={part}
										display={display}
										isFocused={part.id === nextFeedbackId}
									/>
								</Box>
							);
						}
						return [];
					})}
				</Task.Group>
			);
		} else if (part.type === "text") {
			return (
				<Box key={index} flexDirection="column">
					<CompactionBadge compaction={compaction} id={part.id} />
					<Markdown source={part.value} streaming={status === "generating"} />
				</Box>
			);
		} else if (part.type === "attachment") {
			return (
				<Text key={index} color="cyan">
					@{part.label}
					{part.content.type === "directory" ? "/" : ""}
				</Text>
			);
		} else if (part.type === "abort") {
			return (
				<Box
					key={index}
					backgroundColor={part.reason === "error" ? "#872323" : "interior"}
					flexDirection="column"
					paddingX={2}
					paddingY={1}
				>
					<Text bold>{part.reason === "error" ? "Failed" : "Stopped"}</Text>
					<Text>{part.message ?? `Response ended due to ${part.reason}.`}</Text>
				</Box>
			);
		}
		return [];
	});
}
/* biome-ignore-end lint/suspicious/noArrayIndexKey: parts stay in order */
