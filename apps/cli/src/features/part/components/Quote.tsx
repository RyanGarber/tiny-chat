import type { ReactNode } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";

export default function Quote({
	model,
	children,
}: {
	model?: string;
	children: ReactNode;
}) {
	return (
		<Box paddingLeft={2} flexDirection="column">
			{!!model && <Text bold>💬 {model}</Text>}
			<Box flexDirection="column" gap={1}>
				{children}
			</Box>
		</Box>
	);
}
