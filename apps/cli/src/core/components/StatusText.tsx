import { useEmbedding } from "@tiny-chat/client/src/features/user/hooks/useEmbedding.ts";
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

	const { embeddingStatus } = useEmbedding();

	return (
		<Box marginLeft={2} marginY={1} flexDirection="column">
			{!!embeddingStatus.batch && (
				<Box>
					<Text color="primary">
						<Spinner type="circleQuarters" />
						embedding ({embeddingStatus.totalCount})
					</Text>
				</Box>
			)}
			{statuses.map((status) => (
				<Box key={status.id}>
					<Text color="primary">
						{!status.passive && <Spinner type="circleQuarters" />}
						{status.text && (status.passive ? status.text : ` ${status.text}`)}
					</Text>
				</Box>
			))}
		</Box>
	);
}
