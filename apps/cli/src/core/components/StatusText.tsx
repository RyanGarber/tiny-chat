import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useContext } from "react";
import { useShallow } from "zustand/react/shallow";
import { type Status, useAppStore } from "../stores/useAppStore.ts";

const WORKING: Status = { id: "working", text: "working" };

export default function StatusText() {
	const { colorScheme } = useContext(ThemeContext);

	const statuses = useAppStore(
		useShallow((state): Status[] => [
			...state.statuses,
			...(state.workingStatus.size > 0 ? [WORKING] : []),
		]),
	);

	return (
		<Box marginLeft={2} marginY={1} flexDirection="column">
			{statuses.map((status) => (
				<Box key={status.id} gap={1}>
					<Text color={colorScheme.primary}>
						<Spinner type="circleQuarters" />
						{status.text && ` ${status.text}`}
					</Text>
				</Box>
			))}
		</Box>
	);
}
