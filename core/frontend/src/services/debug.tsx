import {Model, ModelArg, Service, Stream} from "./index.ts";
import {MessageUnomitted, zConfigType} from "@tiny-chat/core-backend/types.ts";

export class DebugService implements Service {
    name = "debug";
    apiKeyFormat = "[unused]";

    async getModels() {
        return [{name: "image-sim", features: ["generate" as const]} satisfies Model];
    }

    getArgs(_model: string): ModelArg[] {
        return [];
    }

    getFeatures(_model: string): string[] | null {
        return null;
    }

    async* generate(_instruction: string, _context: MessageUnomitted[], _config: zConfigType): Stream {
        yield {type: "thought", value: "Thinking"};
        await new Promise((resolve) => setTimeout(resolve, 500));

        let words = "Thar be images:".match(/.{3}|.+$/gs)!;
        for (const word of words) {
            yield {type: "text", value: word};
            await new Promise((resolve) => setTimeout(resolve, 1));
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        yield {
            type: "file",
            mime: "image/png",
            name: "image.png",
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            inline: true
        };

        words = "Thar hast been images".match(/.{3}|.+$/gs)!;
        for (const word of words) {
            yield {type: "text", value: word};
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
    }

    async embed(_texts: string[], _config: zConfigType): Promise<number[][]> {
        return [];
    }
}
