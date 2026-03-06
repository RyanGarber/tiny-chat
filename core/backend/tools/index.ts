import {z} from "zod";
import {type Session} from "../server.ts";
import {FindMemories} from "./find-memories.ts";

export interface ToolRunner<T extends z.ZodType = z.ZodType> {
    name: string;
    description: string;
    parameters: ReturnType<z.ZodType["toJSONSchema"]>;
    schema: T;

    run(session: Session, params: z.infer<T>): Promise<any>;
}

export const tools: ToolRunner[] = [FindMemories];
