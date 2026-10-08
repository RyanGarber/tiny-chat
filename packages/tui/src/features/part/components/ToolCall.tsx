import chalk from "chalk";
import { useAutoExpand } from "#client/features/part/hooks/useAutoExpand.ts";
import { useToolCall } from "#client/features/part/hooks/useToolCall.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { RenderedPart } from "#core/features/data/utils/DataUtils.ts";
import type { ToolStatusPart } from "#core/features/tool/types/display.ts";
import Box from "#tui/core/components/Box.tsx";
import Button from "#tui/core/components/Button.tsx";
import ScrollTail from "#tui/features/part/components/ScrollTail.tsx";
import Task from "#tui/features/part/components/Task.tsx";
import ToolBlock from "#tui/features/part/components/ToolBlock.tsx";
import ToolControls from "#tui/features/part/components/ToolControls.tsx";
import type { StatusPart } from "#tui/features/part/utils/TaskUtils.ts";

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
	isNext,
	hold,
}: {
	message?: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	/** The call next waiting on feedback, the one whose controls can take the focus. */
	isNext?: boolean;
	/** Keeps it open after it settles, until something follows it. */
	hold?: boolean;
}) {
	const display = useToolCall({ part });
	const { expanded, auto, toggle } = useAutoExpand(
		part.id,
		display.active || !!hold,
	);

	const controls = message && display.controls;
	const { interrupt } = display;

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
				{interrupt && <Button label="stop" onClick={interrupt} />}
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
									isNext={isNext}
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
