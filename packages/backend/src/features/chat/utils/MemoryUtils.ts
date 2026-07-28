import type { MemoryState } from "@tiny-chat/shared/src/features/data/types/memory.ts";
import type { Memory } from "../../../../generated/prisma/client.ts";

export const MemoryUtils = {
	toMemoryState: (memory: Memory): MemoryState => {
		return {
			...memory,
		};
	},
} as const;
