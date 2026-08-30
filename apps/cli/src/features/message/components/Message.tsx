import type { AgentStreamEvent } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useStream } from "@tiny-chat/client/src/features/agent/hooks/useStream.ts";
import { useMessageBranches } from "@tiny-chat/client/src/features/message/hooks/useMessageBranches.ts";
import type { Compaction } from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import {
	Author,
	type MessageState,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { useWindowSize } from "ink";
import Spinner from "ink-spinner";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";
import MessageParts from "./MessageParts.tsx";

export default function Message({
	message,
	compaction,
}: {
	message: MessageState;
	compaction?: Compaction;
}) {
	const { columns } = useWindowSize();
	const branch = useMessageBranches(message);
	const { mouseRef } = useMouseInput({
		isActive: branch.count > 1,
		onClick: ({ index }) => branch.select(index === 0 ? -1 : 1),
	});

	const stream = useStream<AgentStreamEvent>(message.id)?.items.at(-1);
	const streamed = { ...message, ...stream };

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			<Box
				flexDirection="column"
				backgroundColor={message.author === Author.USER ? "surface" : undefined}
				paddingY={message.author === Author.USER ? 1 : 0}
				paddingX={2}
				gap={1}
				maxWidth={columns - 3}
			>
				<MessageParts
					data={streamed.data}
					status={streamed.status}
					compaction={compaction}
					message={message}
				/>
				{!!streamed.status && (
					<Text>
						<Spinner type="simpleDotsScrolling" />
					</Text>
				)}
			</Box>
			<Box paddingLeft={2} paddingTop={1}>
				<Text color="textSubtle">➤ {message.config.model}</Text>
				{branch.count > 1 && (
					<Box marginLeft={2} gap={1}>
						<Box ref={(element) => mouseRef(element, 0)}>
							<Text dimColor={branch.index <= 0}>{"<"}</Text>
						</Box>
						<Text>
							{branch.index + 1} / {branch.count}
						</Text>
						<Box ref={(element) => mouseRef(element, 1)}>
							<Text dimColor={branch.index >= branch.count - 1}>{">"}</Text>
						</Box>
					</Box>
				)}
			</Box>
		</Box>
	);
}
