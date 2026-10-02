import { useAutoExpand } from "@tiny-chat/client/features/part/hooks/useAutoExpand.ts";
import { useToolCall } from "@tiny-chat/client/features/part/hooks/useToolCall.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import type { ToolStatusPart } from "@tiny-chat/core/features/tool/types/display.ts";
import chalk from "chalk";
import { useInput } from "ink";
import Box from "../../../core/components/Box.tsx";
import Button from "../../../core/components/Button.tsx";
import { useAppStore } from "../../../core/stores/useAppStore.ts";
import type { StatusPart } from "../utils/TaskUtils.ts";
import ScrollTail from "./ScrollTail.tsx";
import Task from "./Task.tsx";
import ToolBlock from "./ToolBlock.tsx";
import ToolControls from "./ToolControls.tsx";

export const toStatusParts = (status: ToolStatusPart[]): StatusPart[] =>
	status.map((part) =>
		part.subject ? { text: part.text, style: chalk.bold } : { text: part.text },
	);

/**
 * A tool call: open while it streams in, runs or waits on the user, showing
 * its input, then any controls, then its output as it arrives; folded back to
 * its status line once it settles.
 */
export default function ToolCall({
	message,
	part,
	isFocused,
	hold,
}: {
	message?: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	isFocused?: boolean;
	/** Keeps it open after it settles, until something follows it. */
	hold?: boolean;
}) {
	const display = useToolCall({ part });
	const { expanded, auto, toggle } = useAutoExpand(display.active || !!hold);

	const controls = message && display.controls;

	// Escape stops a running call from the chat; other pages take it to go back.
	const page = useAppStore((state) => state.page);
	const { interrupt } = display;
	useInput(
		(_, key) => {
			if (key.escape) interrupt?.();
		},
		{ isActive: !!interrupt && page === "chat" },
	);

	return (
		<Task expanded={expanded} onToggle={toggle}>
			<Box gap={1}>
				<Task.Status
					status={
						display.active
							? "pending"
							: display.state === "error"
								? "error"
								: "success"
					}
					emoji="⚙️ "
					parts={toStatusParts(display.status)}
				/>
				{interrupt && <Button label="stop · esc" onClick={interrupt} />}
			</Box>
			{(display.input.length > 0 ||
				display.output.length > 0 ||
				!!controls) && (
				<Task.Details>
					<ScrollTail follow={auto && !controls}>
						<Box flexDirection="column" gap={1}>
							{display.input.map((block, index) => (
								<ToolBlock
									// biome-ignore lint/suspicious/noArrayIndexKey: a tool's blocks keep their order
									key={`input-${index}`}
									block={block}
									active={display.state === "input"}
								/>
							))}
							{controls && message && (
								<ToolControls
									message={message}
									part={part}
									controls={controls}
									isFocused={isFocused}
								/>
							)}
							{display.output.map((block, index) => (
								<ToolBlock
									// biome-ignore lint/suspicious/noArrayIndexKey: a tool's blocks keep their order
									key={`output-${index}`}
									block={block}
									active={display.state === "running"}
								/>
							))}
						</Box>
					</ScrollTail>
				</Task.Details>
			)}
		</Task>
	);
}
