import { Group, Text } from "@mantine/core";
import { ChatCircleIcon } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";

export default function Quote({
	model,
	className,
	children,
	...props
}: ComponentProps<"blockquote"> & { model?: string; children: ReactNode }) {
	return (
		<blockquote
			className={`my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic ${className}`}
			data-streamdown="blockquote"
			{...props}
		>
			{model && (
				<Group gap={5} c="dimmed" mb={4}>
					<ChatCircleIcon size={16} style={{ transform: "scale(-1,1)" }} />
					<Text size="xs">{model}</Text>
				</Group>
			)}
			{children}
		</blockquote>
	);
}
