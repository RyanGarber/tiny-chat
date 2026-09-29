import { Group, Text } from "@mantine/core";
import { CaretRightIcon } from "@phosphor-icons/react";
import type { ToolStatusPart } from "@tiny-chat/core/features/tool/types/display.ts";
import type { ReactNode } from "react";

/** The clickable status line a tool call, or a group of them, collapses to. */
export default function ToolHeader({
	icon,
	status,
	active,
	error,
	expanded,
	onToggle,
}: {
	icon: ReactNode;
	status: ToolStatusPart[];
	active: boolean;
	error?: boolean;
	expanded: boolean;
	onToggle?: () => void;
}) {
	return (
		<Group
			className={`group shimmer-text ${active ? "active" : ""}`}
			onClick={onToggle}
			style={{ cursor: onToggle ? "pointer" : undefined }}
			gap="xs"
			wrap="nowrap"
		>
			{icon}
			<Text truncate="end" c={error ? "red" : undefined} miw={0}>
				{status.map((part, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: parts stay in order
						key={index}
						style={part.subject ? { fontWeight: 500 } : undefined}
					>
						{index > 0 && " "}
						{part.text}
					</span>
				))}
			</Text>
			{onToggle && (
				<CaretRightIcon
					size={14}
					color="var(--mantine-color-dimmed)"
					className="shrink-0 opacity-0 transition-[opacity,transform] group-hover:opacity-100"
					style={{ transform: expanded ? "rotate(90deg)" : undefined }}
				/>
			)}
		</Group>
	);
}
