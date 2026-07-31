import { Box, Group, Stack } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { type CSSProperties, memo } from "react";
import { Author, type MessageState } from "#core/features/data/types/message";
import { MessageBodyContent } from "#ui/features/message/components/MessageBodyContent.tsx";
import { GLASS_STYLE, SHADOW } from "#ui/utils/style.ts";
import { useMessageStream } from "../../../../../react/src/features/chat/hooks/useStreaming.ts";

const MessageBody = memo(
	function MessageBody({
		message,
		style,
	}: {
		message: MessageState;
		style?: CSSProperties;
	}) {
		// For model messages, prefer the live stream snapshot when streaming so
		// the loader dots and pending-tool detection are accurate token-by-token.
		const stream = useMessageStream(
			message.author === Author.MODEL ? message.id : undefined,
		);
		const live = stream ?? message;

		const { ref: containerRef, width: containerWidth } = useElementSize();

		if (message.author === Author.USER) {
			const hasText = DataUtils.getText(message).trim().length > 0;
			return (
				<Group w="100%" justify="end" ref={containerRef} style={style}>
					<Stack gap={5} w="fit-content">
						{hasText && (
							<Box
								px={20}
								py={10}
								bdrs={20}
								style={{
									boxShadow: SHADOW,
									alignSelf: "flex-end",
									...GLASS_STYLE,
								}}
							>
								<MessageBodyContent
									message={message}
									containerWidth={containerWidth}
								/>
							</Box>
						)}
					</Stack>
				</Group>
			);
		} // no thinking or generating for user messages

		return (
			<Box w="100%" ref={containerRef} style={style}>
				<Box display="inline">
					<MessageBodyContent
						message={message}
						containerWidth={containerWidth}
					/>
					{live.state.any && (
						<Box
							component="span"
							display="inline-block"
							style={{ verticalAlign: "middle" }}
							className="shimmer-text active"
							fz="25px"
						>
							&middot;&middot;&middot;
						</Box>
					)}
				</Box>
			</Box>
		);
	},
	(prev, next) =>
		prev.message.data === next.message.data &&
		prev.message.state === next.message.state &&
		prev.style === next.style,
);

export default MessageBody;
