import { Box, Group, Stack } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { type CSSProperties, useMemo } from "react";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { MessageBodyContent } from "#app/features/message/components/MessageBodyContent.tsx";
import { Author, type MessageState } from "#core/features/data/types/message";

export default function MessageBody({
	message,
	style,
}: {
	message: MessageState;
	style?: CSSProperties;
}) {
	const stream = useStream<AgentStreamEvent>(message.id)?.items.at(-1);
	const streamed = useMemo(
		() => ({ ...message, ...stream }),
		[message, stream],
	);

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
								boxShadow: StyleUtils.shadow,
								alignSelf: "flex-end",
								...StyleUtils.glass,
							}}
						>
							<MessageBodyContent
								message={streamed}
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
					message={streamed}
					containerWidth={containerWidth}
				/>
				{!!streamed.status && (
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
}
