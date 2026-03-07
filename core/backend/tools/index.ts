import {z} from "zod";
import {type Session} from "../server.ts";
import {SearchMemory} from "./search-memory.ts";
import {searchProviders} from "../providers/search/index.ts";
import {SearchWeb} from "./search-web.ts";

export interface CustomTool<T extends z.ZodType = z.ZodType> {
    name: string;
    description: string;
    parameters: ReturnType<z.ZodType["toJSONSchema"]>;
    schema: T;

    run(session: Session, params: z.infer<T>): Promise<any>;
}

export const tools = (session: Session) => {
    const available: CustomTool[] = [SearchMemory];
    if (session.user.settings.services?.[searchProviders[0].name]?.apiKey) {
        available.push(SearchWeb);
    }
    return available;
};