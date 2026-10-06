import type { Model } from "#core/core/services/PostgresService.ts";
import type { PartialBy } from "#core/core/types/common.ts";
import type { MemoryState } from "#core/features/data/types/memory.ts";

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
