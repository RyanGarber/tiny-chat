import type { AgentStreamEvent } from "#client/core/services/StreamService.ts";
import { useMessageStore } from "#client/features/message/stores/useMessageStore.ts";
import type { Compaction } from "#core/features/agent/services/AgentTokensService.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zData } from "#core/features/data/types/part.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { EditorPartUtils } from "#core/features/data/utils/EditorPartUtils.ts";
import Box from "#tui/core/components/Box.tsx";
import Button from "#tui/core/components/Button.tsx";
import Text from "#tui/core/components/Text.tsx";
import Markdown from "#tui/features/message/components/Markdown.tsx";
import Thought from "#tui/features/part/components/Thought.tsx";
import ToolGroup from "#tui/features/part/components/ToolGroup.tsx";

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
	const regenerate = useMessageStore((s) => s.regenerate);
	const resume = useMessageStore((s) => s.resume);

	const parts = DataUtils.getRenderedPartsGrouped(
		data,
		status === "thinking",
		"thought",
		"toolCall",
	);

	// The last part stays open while the message is still streaming, so it does
	// not fold between one call or thought and whatever comes after it.
	const hold = (index: number) =>
		status !== undefined && index === parts.length - 1;

	return parts.flatMap((part, index) => {
		if (EditorPartUtils.isRun(part)) {
			const previous = parts[index - 1];
			if (previous && EditorPartUtils.isRun(previous)) return [];
			const run = EditorPartUtils.toRun(parts.slice(index));
			return (
				<Box key={index} flexDirection="column">
					{run.map((item) => (
						<CompactionBadge
							key={item.id}
							compaction={compaction}
							id={item.id}
						/>
					))}
					<Markdown source={[run]} streaming={status === "generating"} />
				</Box>
			);
		}
		if (part.type === "interjection")
			return (
				<Box
					key={part.id}
					backgroundColor="surface"
					flexDirection="column"
					paddingX={1}
				>
					<Text color="textSubtle">You</Text>
					<MessageParts data={[part.value]} compaction={compaction} />
				</Box>
			);
		if (part.type === "group" && part.of === "thought") {
			return (
				<Box key={index} flexDirection="column">
					<CompactionBadge
						compaction={compaction}
						id={part.value.find((thought) => compaction?.has(thought.id))?.id}
					/>
					<Thought thoughts={part.value} hold={hold(index)} />
				</Box>
			);
		}
		if (part.type === "group" && part.of === "toolCall") {
			return (
				<ToolGroup
					key={index}
					message={message}
					parts={part.value}
					compaction={compaction}
					hold={hold(index)}
				/>
			);
		} else if (part.type === "abort") {
			return (
				<Box
					key={index}
					backgroundColor={part.reason === "error" ? "#872323" : "interior"}
					color={part.reason === "error" ? "white" : undefined}
					flexDirection="column"
					paddingX={2}
					paddingY={1}
				>
					<Text bold>
						{part.reason === "error" ? "Failed" : "Stopped"}: {part.reason}
					</Text>
					<Text>{part.message ?? JSON.stringify(part.details)}</Text>
					{/* Once the reply carries on past it, it has nothing left to offer. */}
					{message && status === undefined && index === parts.length - 1 && (
						<Box justifyContent="flex-end" gap={2}>
							<Button label="continue" onClick={() => resume(message)} />
							<Button label="retry" onClick={() => regenerate(message)} />
						</Box>
					)}
				</Box>
			);
		}
		return [];
	});
}
/* biome-ignore-end lint/suspicious/noArrayIndexKey: parts stay in order */
