import { Text } from "@mantine/core";
import type { Compaction } from "#core/features/agent/services/AgentTokensService.ts";

/** Marks a part that has been compacted out of what the model sees. */
export default function CompactionBadge({
	compaction,
	id,
}: {
	compaction?: Compaction;
	id?: string;
}) {
	const status = id ? compaction?.get(id) : undefined;
	return status ? (
		<Text component="span" size="xs" c="dimmed" fs="italic" mr={4}>
			[{status}]
		</Text>
	) : null;
}
