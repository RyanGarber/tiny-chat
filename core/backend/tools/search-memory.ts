import z from "zod";
import {type CustomTool} from "./index.ts";
import {listRelevantMemories} from "../routes/context.ts";
import {embed} from "../routes/providers.ts";
import {MemoryCategory} from "../generated/prisma/enums.ts";

const schema = z.object({
    query: z.string().describe("The query to search for in memories"),
    category: z.array(z.enum(MemoryCategory)).optional().describe("The category of memories to include"),
});

export const SearchMemory: CustomTool<typeof schema> = {
    name: "search_memory",
    description: "Find information from memory. Use this tool to get relevant facts about the user. You can optionally filter memories by category.",
    parameters: schema.toJSONSchema(),
    schema,
    run: async (session, params) => {
        const embedding = (await embed(session, [params.query]))[0];
        const memories = await listRelevantMemories(session, embedding, params.category);
        return memories.map(m => ({
            fact: m.fact,
            category: m.category,
            evidence: m.evidence,
        }));
    }
}