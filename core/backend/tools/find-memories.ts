import z from "zod";
import {type ToolRunner} from "./index.ts";
import {listRelevantMemories} from "../routes/context.ts";
import {embed} from "../routes/services.ts";
import {zConfig} from "../types.ts";

const schema = z.object({
    fact: z.string().describe("Fact to find in memory"),
});

export const FindMemories: ToolRunner<typeof schema> = {
    name: "find_memories",
    description: "Find information stored in memories",
    parameters: schema.toJSONSchema(),
    schema,
    run: async (session, params) => {
        const embedding = (await embed(session, [params.fact]))[0];
        const memories = await listRelevantMemories(session, embedding);
        return memories.map(m => ({
            fact: m.fact,
            confidence: m.confidence,
            evidence: m.evidence,
            savedByModel: zConfig.parse(m.config).model
        }));
    }
}