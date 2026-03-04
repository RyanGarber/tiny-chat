import type {MessageUnomitted, Model, zConfig, zGenerateOutput} from "../types.ts";
import type {ServiceRunner} from "./index.ts";

export class Debug implements ServiceRunner {
    name = "debug";
    settings = [];

    async getModels(_settings: any) {
        return [{name: "image-sim", features: ["generate" as const], args: []} satisfies Model];
    }

    async* generate(_settings: any, _instruction: string, _context: MessageUnomitted[], _config: zConfig, abortSignal: AbortSignal): AsyncGenerator<zGenerateOutput> {
        yield {type: "data", value: {type: "thought", value: "Thinking"}};
        await new Promise((resolve) => setTimeout(resolve, 500));

        let words = "Thar be images:".match(/.{3}|.+$/gs)!;
        for (const word of words) {
            yield {type: "data", value: {type: "text", value: word}};
            await new Promise((resolve) => setTimeout(resolve, 25));
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        yield {
            type: "data", value: {
                type: "file",
                mime: "image/png",
                name: "image.png",
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                inline: true
            }
        };

        words = "Thar hast been images".match(/.{3}|.+$/gs)!;
        for (const word of words) {
            yield {type: "data", value: {type: "text", value: word}};
            await new Promise((resolve) => setTimeout(resolve, 25));
        }

        if (abortSignal.aborted) console.log("Aborted");

        yield {type: "special", value: {type: "metadata", value: {}}}
    }

    async embed(_settings: any, _texts: string[], _config: zConfig): Promise<number[][]> {
        return [];
    }
}
