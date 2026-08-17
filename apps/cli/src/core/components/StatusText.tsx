import Spinner from "ink-spinner";
import { useShallow } from "zustand/react/shallow";
import { type Status, useAppStore } from "../stores/useAppStore.ts";
import Box from "./Box.tsx";
import Text from "./Text.tsx";

const WORKING: Status = { id: "working", text: "working" };

export default function StatusText() {
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
					<Text color="primary">
						{!status.passive && <Spinner type="circleQuarters" />}
						{status.text && (status.passive ? status.text : ` ${status.text}`)}
					</Text>
				</Box>
			))}
		</Box>
	);
}
