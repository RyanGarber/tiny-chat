import type { FieldOutputTypes } from "@tiny-chat/core/generated/prisma/contract.d.ts";
import type { MemoryState } from "@tiny-chat/core/src/features/data/types/memory.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";

export const MemoryUtils = {
	toMemoryState: (
		memory: FieldOutputTypes["public"]["Memory"],
	): MemoryState => {
		return {
			...memory,
			config: memory.config === null ? null : zConfig.parse(memory.config),
			evidence: [...memory.evidence],
		};
	},
} as const;
