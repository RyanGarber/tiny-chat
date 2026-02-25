import {ModelArg, Service, Stream} from "./index.ts";
import {MessageUnomitted, zConfigType, zMetadata} from "@tiny-chat/core-backend/types.ts";

export class DebugService implements Service {
    name = "debug";
    apiKeyFormat = "[unused]";

    async getModels() {
        return ["links", "code", "args"];
    }

    getArgs(model: string): ModelArg[] {
        if (model !== "args") return [];
        return [
            {type: "range", name: "legendariness", min: 1, max: 10, step: 1, default: 10},
            {type: "list", name: "legitness", values: ["truly-legit", "rightfully-legit"], default: "truly-legit"}
        ];
    }

    getFeatures(_model: string): string[] | null {
        return null;
    }

    async* generate(_instruction: string, _context: MessageUnomitted[], config: zConfigType): Stream {
        await new Promise((resolve) => setTimeout(resolve, 500));

        yield {type: "thought", value: "Thinking"};

        await new Promise((resolve) => setTimeout(resolve, 500));

        yield {type: "thought", value: "Thinking about thinking"};

        await new Promise((resolve) => setTimeout(resolve, 500));

        let text;
        if (config.model === "links") text = `Some links:
[Google](https://google.com)
https://google.com
google.com
[![Dachshund](https://www.burgesspetcare.com/wp-content/uploads/2024/09/shutterstock_2423158743.jpg)](https://google.com)
**Bold [link](https://google.com)**`;
        else if (config.model === "code") text = `\`\`\`typescript
type FilterPropsRes<T extends Record<string, any>> = {
  [Key in keyof T]-?: T[Key] extends undefined ? never : T[Key];
};

export function filterProps<T extends Record<string, any>>(props: T) {
  return Object.keys(props).reduce<FilterPropsRes<T>>((acc, key: keyof T) => {
    if (props[key] !== undefined) {
      acc[key] = props[key];
    }
    return acc;
  }, {} as FilterPropsRes<T>);
}
\`\`\``;
        else if (config.model === "args") text = `legendariness: ${config.args.legendariness}
legitness converted to realness: ${({
            'truly-legit': 'truly real',
            'rightfully-legit': 'rightfully real'
        })[config.args.legitness as string]}`;
        else throw new Error("No such model");

        const words = text.match(/.{3}|.+$/gs)!;

        for (const word of words) {
            yield {type: "text", value: word};
            await new Promise((resolve) => setTimeout(resolve, 1));
        }

        // Simulate raw Gemini Part[]
        yield {metadata: zMetadata.parse(words.map((word) => ({text: word})))};
    }

    async embed(_texts: string[], _config: zConfigType): Promise<number[][]> {
        return [];
    }
}
