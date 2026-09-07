import {
	ActionIcon,
	Alert,
	Box,
	type BoxProps,
	Group,
	Portal,
	Text,
	Transition,
} from "@mantine/core";
import {
	ArrowClockwiseIcon,
	ChatCircleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import type { Compaction } from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import { type CSSProperties, useMemo } from "react";
import { EditorUtils } from "#app/features/editor/utils/EditorUtils.ts";
import MessageParts from "#app/features/message/components/MessageParts.tsx";
import { useMessageSelection } from "#app/features/message/hooks/useMessageSelection.ts";
import type { MessageState } from "#core/features/data/types/message";

export default function MessageBody({
	message,
	style,
	compaction,
}: {
	message: MessageState;
	style?: CSSProperties;
	compaction?: Compaction;
}) {
	const stream = useStream<AgentStreamEvent>(message.id)?.items.at(-1);
	const streamed = { ...message, ...stream };

	// An earlier model message with a newer timestamp means the chat was edited
	// above this response. Resolved for the whole list in MessageProvider.
	const isStaleId = useMessageStore((s) => s.staleIds.has(message.id));
	const regenerate = useMessageStore((s) => s.regenerate);

	const { rect, captureSelection, getSelectedText } = useMessageSelection(
		message.id,
	);

	const isSelected = rect !== null;

	const handleQuoteClick = () => {
		const text = getSelectedText();
		if (text) EditorUtils.insertQuote(streamed.config.model, text);
	};

	const boxProps = useMemo<BoxProps>(() => {
		switch (streamed.author) {
			case "USER":
				return {
					px: 20,
					py: 10,
					bdrs: 20,
					style: {
						alignSelf: "flex-end",
						border: "1px solid var(--mantine-color-default-border)",
					},
					className: "glass",
					maw: "100%",
				};
			case "MODEL":
				return {
					w: "100%",
				};
		}
	}, [streamed.author]);

	const isStale = !streamed.status && isStaleId;

	return (
		<Group w="100%" justify="end" style={style}>
			<Box {...boxProps}>
				<Box display="inline" data-message-id={streamed.id}>
					{streamed.author === "MODEL" && isStale && (
						<Alert variant="light" mb="lg">
							<Group justify="space-between">
								<Group>
									<WarningCircleIcon size={20} />
									<Text>Edits in the chat may change this response</Text>
								</Group>
								<ActionIcon
									variant="subtle"
									onClick={() => regenerate(streamed)}
								>
									<ArrowClockwiseIcon size={20} />
								</ActionIcon>
							</Group>
						</Alert>
					)}
					<MessageParts
						message={streamed}
						data={streamed.data}
						status={streamed.status}
						compaction={compaction}
						regenerate={regenerate}
					/>
					{!!streamed.status && (
						<Box
							component="span"
							style={{ verticalAlign: "middle" }}
							className="shimmer-text active"
							fz="25px"
						>
							&middot;&middot;&middot;
						</Box>
					)}
					{streamed.author === "MODEL" && (
						<Portal target={document.body}>
							<Transition mounted={isSelected ?? false} transition="fade">
								{(styles) => (
									<ActionIcon
										className="glass-shadow"
										size={32}
										style={{
											position: "fixed",
											top: (rect?.top ?? 0) - 30,
											left: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
											transform: "translateX(-50%)",
											zIndex: "var(--mantine-zindex-app)",
											...styles,
										}}
										onMouseDown={captureSelection}
										onTouchStart={captureSelection}
										onClick={handleQuoteClick}
									>
										<ChatCircleIcon
											size={18}
											style={{ transform: "scale(-1,1)" }}
										/>
									</ActionIcon>
								)}
							</Transition>
						</Portal>
					)}
				</Box>
			</Box>
		</Group>
	);
}
