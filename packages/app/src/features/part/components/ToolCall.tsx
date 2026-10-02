import { Box, Collapse, Stack } from "@mantine/core";
import { WrenchIcon } from "@phosphor-icons/react";
import { useAutoExpand } from "@tiny-chat/client/features/part/hooks/useAutoExpand.ts";
import { useToolCall } from "@tiny-chat/client/features/part/hooks/useToolCall.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import Tail from "./Tail.tsx";
import ToolBlock from "./ToolBlock.tsx";
import ToolControls from "./ToolControls.tsx";
import ToolHeader from "./ToolHeader.tsx";

/** Height the call is held to while it is open on its own. */
const TAIL_HEIGHT = 400;

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
	const empty = !display.input.length && !display.output.length && !controls;

	return (
		<Box my={8}>
			<ToolHeader
				icon={
					<WrenchIcon
						size={20}
						color="var(--mantine-color-dimmed)"
						className="shrink-0"
					/>
				}
				status={display.status}
				active={display.active}
				error={display.state === "error"}
				expanded={expanded && !empty}
				onToggle={empty ? undefined : toggle}
				onInterrupt={display.interrupt}
			/>
			<Collapse expanded={expanded && !empty} keepMounted={false}>
				<Box
					style={{
						borderLeft: "2px solid var(--mantine-color-default-border)",
					}}
					pl="md"
					py="xs"
					ml={9}
					mt={4}
				>
					<Tail follow={auto} height={TAIL_HEIGHT} content={part}>
						<Stack gap="xs" style={{ zoom: 0.9 }}>
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
						</Stack>
					</Tail>
				</Box>
			</Collapse>
		</Box>
	);
}
