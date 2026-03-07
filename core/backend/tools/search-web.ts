import {type CustomTool} from "./index.ts";
import {z} from "zod";
import {searchProviders} from "../providers/search/index.ts";

const schema = z.object({
    query: z.string().describe("The search query to use for web search"),
});

export const SearchWeb: CustomTool<typeof schema> = {
    name: "search_web",
    description: "Search the web for information. Use this tool to find up-to-date information on any topic.",
    parameters: schema.toJSONSchema(),
    schema,
    run: async (session, params) => {
        return await searchProviders[0].search(session, params.query, 5);
    }
}