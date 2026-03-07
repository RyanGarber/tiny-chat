import {type CustomTool} from "./index.ts";
import {z} from "zod";

const schema = z.object({
    change: z.string().describe("An explanation of the change to make"),
})

export const UpdateMemory: CustomTool<typeof schema> = {
    name: "update_memory",
    description: "Update the agent's memory with new information. Use this tool to add new information, update existing information, or remove previous information.",
    parameters: schema.toJSONSchema(),
    schema,
    run: async (session, params) => {
        // TODO - move regular memory updates to backend, have this tool 'force' an update (cleanup) with a specific change
    }
}