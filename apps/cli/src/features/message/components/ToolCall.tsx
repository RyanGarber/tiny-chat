import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useActions } from "@tiny-chat/client/src/features/user/hooks/useActions.ts";
import type { zDataPart } from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import cliSpinners from "cli-spinners";
import { Box, Text } from "ink";
import { Task } from "ink-task-list";

export default function ToolCall({
	toolCall,
	toolResult,
}: {
	toolCall: Extract<zDataPart, { type: "toolCall" }>;
	toolResult?: Extract<zDataPart, { type: "toolResult" }>;
}) {
	const { toolsets } = useTools();
	const { actions } = useActions();

	const { status, pending, error } = ToolCallUtils.getDisplay({
		toolCall,
		toolResult,
		toolsets,
		actions: actions.data,
	});

	return (
		<Task
			label={status}
			state={pending ? "loading" : error ? "error" : "success"}
			spinner={cliSpinners.dots}
			isExpanded={!!toolResult?.append?.length}
		>
			{toolResult?.append?.length ? (
				<Box
					borderLeft={true}
					borderColor="gray"
					borderStyle="single"
					paddingLeft={1}
					gap={1}
				>
					<Text color="blueBright">{"+ "}</Text>
					<Text dimColor>
						{DataUtils.getText({ data: [toolResult.append] })}
					</Text>
				</Box>
			) : undefined}
		</Task>
	);
}
