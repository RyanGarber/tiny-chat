import type {Model, zGenerateOutput} from "../../types.ts";
import type {ChatProvider} from "./index.ts";

export const Debug: ChatProvider = {
    name: "debug",
    settings: [],

    async getModels(_session) {
        return [{name: "tool-sim", features: ["generate" as const], args: []} satisfies Model];
    },

    async* generate(_session, _instruction, context, _config, _abortSignal, _tools) {
        const data: zGenerateOutput[] = [];

        const result = context[context.length - 1].data.find(p => p.type === "toolResult");
        if (!result) {
            yield {type: "data", value: {type: "thought", value: "Thinking evil thoughts"}};
            await new Promise((resolve) => setTimeout(resolve, 500));

            let words = "Searching for the meaning of life...".match(/.{3}|.+$/gs)!;
            for (const word of words) {
                data.push({type: "data", value: {type: "text", value: word}});
                yield data[data.length - 1];
                await new Promise((resolve) => setTimeout(resolve, 25));
            }

            data.push({
                type: "data",
                value: {type: "toolCall", name: "search_web", args: {query: "meaning of life"}, id: "1"}
            });
            yield data[data.length - 1];
        } else {
            const chosen = result.value[Math.floor(Math.random() * result.value.length)];
            data.push({
                type: "data",
                value: {
                    type: "text",
                    value: !result.error ? `The meaning of life is: ${chosen.content}\n\n(Source: ${chosen.source})` : "Couldn't find it :("
                }
            });
            yield data[data.length - 1];
        }
        yield {type: "special", value: {type: "metadata", value: data}}
    },

    async embed(_session, _texts, _config) {
        return [];
    }
}
