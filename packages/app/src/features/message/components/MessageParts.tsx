import { Alert, Button, Stack, Text } from "@mantine/core";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import type { AgentStreamEvent } from "@tiny-chat/client/core/services/StreamService.ts";
import { MarkdownDataUtils } from "@tiny-chat/client/features/message/utils/MarkdownDataUtils.ts";
import { useThemes } from "@tiny-chat/client/features/settings/hooks/useThemes.ts";
import type { Compaction } from "@tiny-chat/core/features/agent/services/AgentTokensService.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zData } from "@tiny-chat/core/features/data/types/part.ts";
import { DataUtils } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import { EditorPartUtils } from "@tiny-chat/core/features/data/utils/EditorPartUtils.ts";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
	DefaultAudioLayout,
	DefaultVideoLayout,
	defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import Code from "#app/features/code/components/Code.tsx";
import CompactionBadge from "#app/features/message/components/CompactionBadge.tsx";
import Markdown from "#app/features/message/components/Markdown.tsx";
import Image from "#app/features/part/components/Image.tsx";
import Thought from "#app/features/part/components/Thought.tsx";
import ToolGroup from "#app/features/part/components/ToolGroup.tsx";

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

	return parts.map((part, index) => {
		if (part.type === "text" || EditorPartUtils.is(part)) {
			const previous = parts[index - 1];
			if (
				previous &&
				(previous.type === "text" || EditorPartUtils.is(previous))
			)
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
		if (part.type === "group" && part.of === "thought") {
			return (
				<div key={index}>
					<CompactionBadge
						compaction={compaction}
						id={part.value.find((thought) => compaction?.has(thought.id))?.id}
					/>
					<Thought thoughts={part.value} hold={hold(index)} />
				</div>
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
					title={`${part.reason === "error" ? "Failed" : "Stopped"}: ${part.reason}`}
				>
					<Stack align="flex-end">
						<Text size="sm" w="100%">
							{part.message ?? JSON.stringify(part.details)}
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
