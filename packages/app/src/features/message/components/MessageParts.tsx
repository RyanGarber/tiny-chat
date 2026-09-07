import { Alert, Button, Stack, Text } from "@mantine/core";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import { MarkdownDataUtils } from "@tiny-chat/client/src/features/message/utils/MarkdownDataUtils.ts";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import type { Compaction } from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zData } from "@tiny-chat/core/src/features/data/types/part.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import Code from "#app/features/code/components/Code.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import Image from "#app/features/part/components/Image.tsx";
import Thought from "#app/features/part/components/Thought.tsx";
import ToolCall from "#app/features/part/components/ToolCall.tsx";
import ToolFeedback from "#app/features/part/components/ToolFeedback.tsx";

function CompactionBadge({
	compaction,
	id,
}: {
	compaction?: Compaction;
	id?: string;
}) {
	const status = id ? compaction?.get(id) : undefined;
	return status ? (
		<Text component="span" size="xs" c="dimmed" fs="italic" mr={4}>
			[{status}]
		</Text>
	) : null;
}

/* biome-ignore-start lint/suspicious/noArrayIndexKey: parts stay in order */
export default function MessageParts({
	message,
	data,
	status,
	compaction,
	regenerate,
}: {
	message?: MessageState;
	data: zData;
	status?: AgentStreamEvent["status"];
	compaction?: Compaction;
	regenerate?: (message: MessageState) => void;
}) {
	const { theme } = useThemes();

	const toolsets = useMessageStore((s) => s.toolsets);
	const nextFeedbackId = useMessageStore((s) => s.nextFeedbackId);

	const parts = DataUtils.getRenderedPartsGrouped(
		data,
		status === "thinking",
		"thought",
	);

	return parts.map((part, index) => {
		if (part.type === "text" || part.type === "attachment") {
			const previous = parts[index - 1];
			if (previous?.type === "text" || previous?.type === "attachment")
				return null;
			const run = MarkdownDataUtils.toInlineParts(parts.slice(index));
			return (
				<div key={index}>
					{run.map((item) => (
						<CompactionBadge
							key={item.id}
							compaction={compaction}
							id={item.id}
						/>
					))}
					<Markdown source={[run]} streaming={status !== undefined} />
				</div>
			);
		}
		if (part.type === "interjection")
			return (
				<Stack key={part.id} bg="var(--tc-surface)" p="sm" gap="xs">
					<Text size="xs" c="dimmed">
						You
					</Text>
					<MessageParts data={[part.value]} compaction={compaction} />
				</Stack>
			);
		if (part.type === "group") {
			const statusPart = part.value.find(
				(value) => value.id && compaction?.has(value.id),
			);
			return (
				<div key={index}>
					<CompactionBadge compaction={compaction} id={statusPart?.id} />
					<Thought thoughts={part.value} />
				</div>
			);
		} else if (part.type === "toolCall") {
			const display = ToolCallUtils.getDisplay({
				part,
				toolsets,
			});
			return (
				<div key={index}>
					<CompactionBadge compaction={compaction} id={part.id} />
					<ToolCall part={part} display={display} />
					{message && (display.approval || display.feedback) && (
						<ToolFeedback
							message={message}
							part={part}
							display={display}
							isFocused={nextFeedbackId === part.id}
						/>
					)}
				</div>
			);
		} else if (part.type === "json") {
			return (
				<div key={index}>
					<CompactionBadge compaction={compaction} id={part.id} />
					<Code
						language="json"
						code={JSON.stringify(part.value, null, 4)}
						streaming={status !== undefined}
					/>
				</div>
			);
		} else if (part.type === "file") {
			if (part.mime.startsWith("image/")) {
				return (
					<div key={index}>
						<CompactionBadge compaction={compaction} id={part.id} />
						<Image
							src={`data:${part.mime};base64,${part.data}`}
							filename={part.name}
							radius="md"
							maw="100%"
							w="auto"
							my={4}
						/>
					</div>
				);
			} else if (part.mime.startsWith("video/")) {
				return (
					<div key={index}>
						<CompactionBadge compaction={compaction} id={part.id} />
						<MediaPlayer
							title={part.name}
							src={`data:${part.mime};base64,${part.data}`}
							crossOrigin
							playsInline
						>
							<MediaProvider></MediaProvider>
							<DefaultAudioLayout
								icons={defaultLayoutIcons}
								colorScheme={theme}
							/>
							<DefaultVideoLayout
								icons={defaultLayoutIcons}
								colorScheme={theme}
							/>
						</MediaPlayer>
					</div>
				);
			}
		} else if (part.type === "abort") {
			return (
				<Alert
					key={index}
					mb={10}
					color={part.reason === "error" ? "red" : "gray"}
					variant="light"
					title={part.reason === "error" ? "Failed" : "Stopped"}
				>
					<Stack align="flex-end">
						<Text fz="15px" w="100%">
							{part.message ?? `Response ended due to ${part.reason}.`}
						</Text>
						{message && regenerate && (
							<Button
								variant="subtle"
								color="dimmed"
								onClick={() => regenerate(message)}
								leftSection={<ArrowClockwiseIcon size={20} />}
							>
								Retry
							</Button>
						)}
					</Stack>
				</Alert>
			);
		}
		return null;
	});
} /* biome-ignore-end lint/suspicious/noArrayIndexKey: parts stay in order */
