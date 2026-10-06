import type {
	EmbeddingCapability,
	MemoriesCapability,
} from "#core/core/types/capability.ts";
import { createCreateMemoryTool } from "#core/features/tool/tools/memories/create_memory.ts";
import { createDeleteMemoryTool } from "#core/features/tool/tools/memories/delete_memory.ts";
import { createSearchChatsTool } from "#core/features/tool/tools/memories/search_chats.ts";
import { createSearchMemoriesTool } from "#core/features/tool/tools/memories/search_memories.ts";
import { createUpdateMemoryTool } from "#core/features/tool/tools/memories/update_memory.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createMemoriesToolset: ToolsetFactory<
	Toolset<{ embedding?: EmbeddingCapability; memories: MemoriesCapability }>
> = async (options) => ({
	name: "memories",
	tools: [
		await createCreateMemoryTool(options),
		await createUpdateMemoryTool(options),
		await createDeleteMemoryTool(options),
		await createSearchMemoriesTool(options),
		await createSearchChatsTool(options),
	],
	...options,
});
