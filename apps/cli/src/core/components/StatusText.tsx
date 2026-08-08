import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useAppStore } from "../stores/useAppStore.ts";

export default function StatusText() {
	const statuses = useAppStore((state) => state.statuses);

	return statuses.map((status) => (
		<Box key={status.id} gap={1} marginLeft={1}>
			<Text color="blueBright">
				<Spinner type="circleQuarters" />
			</Text>
			<Text>{status.text ?? "working..."}</Text>
		</Box>
	));
}
