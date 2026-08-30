export const MemoryBudgetUtils = {
	// Conservative estimate including serialized metadata, not just fact text.
	withinBudget: <T>(memories: T[], tokens: number): T[] => {
		let remaining = tokens * 3;
		return memories.filter((memory) => {
			const size = JSON.stringify(memory).length + 200;
			if (size > remaining) return false;
			remaining -= size;
			return true;
		});
	},
} as const;
