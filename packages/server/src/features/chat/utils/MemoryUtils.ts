import type { Model } from "@tiny-chat/core/core/services/PostgresService.ts";
import type { PartialBy } from "@tiny-chat/core/core/types/common.ts";
import type { MemoryState } from "@tiny-chat/core/features/data/types/memory.ts";

export const MemoryUtils = {
	toMemoryState: ({
		embedding,
		...memory
	}: PartialBy<Model["Memory"], "embedding">): MemoryState => {
		return {
			...memory,
			evidence: [...memory.evidence],
		};
	},
} as const;
