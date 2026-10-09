import { Kbd, Popover, ScrollAreaAutosize, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import { type ReactNode, useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { useShellCommand } from "#client/features/shell/hooks/useShellCommand.ts";
import ToolCall from "#gui/features/part/components/ToolCall.tsx";

/**
 * The last command run with `!`, floating over the editor it was typed in for
 * as long as the editor is in shell mode or the command runs. It is drawn as
 * the tool call it is, so it streams, scrolls and stops like any other.
 */
export default function Shell({ children }: { children: ReactNode }) {
	const client = useContext(ClientContext);
	const os = useOs();
	const { run, toolsets, isOpen } = useShellCommand();

	return (
		<Popover
			opened={isOpen}
			position="top-start"
			width="target"
			offset={5}
			trapFocus={false}
			returnFocus={false}
			closeOnEscape={false}
			closeOnClickOutside={false}
		>
			<Popover.Target>{children}</Popover.Target>
			<Popover.Dropdown py={0} className="selectable">
				{run && (
					<ScrollAreaAutosize mah="50vh" type="auto">
						<ToolCall part={run} toolsets={toolsets} hold />
					</ScrollAreaAutosize>
				)}
				<Text size="xs" c="dimmed" py={8}>
					<Kbd size="xs">{os === "macos" ? "⌘" : "Ctrl"}</Kbd> +{" "}
					<Kbd size="xs">Enter</Kbd> runs the command{" "}
					{client.shell ? "in your shell" : "in this chat's files"}
				</Text>
			</Popover.Dropdown>
		</Popover>
	);
}
