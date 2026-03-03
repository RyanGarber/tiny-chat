import type {MessageUnomitted, Model, zConfig, zDataPart} from "../types.ts";
import {type ServiceRunner, SettingsError} from "./index.ts";
import {Author} from "../generated/prisma/enums.ts";
import {Anthropic} from "@anthropic-ai/sdk";
// @ts-ignore
import type {ContentBlockParam, ImageBlockParam, MessageParam, TextBlockParam} from "@anthropic-ai/sdk/client";

export class AnthropicAi implements ServiceRunner {
    name = "anthropic-ai";
    settings = ["apiKey"]

    getClient(settings: any) {
        return new Anthropic({
            apiKey: settings.apiKey,
        })
    }

    async getModels(settings: any): Promise<Model[]> {
        if (!settings.apiKey) return [];
        
        const client = this.getClient(settings);

        return (await client.models.list()).data.map(m => ({name: m.id, features: ["generate" as const], args: []}));
    }

    async* generate(settings: any, instruction: string, context: MessageUnomitted[], config: zConfig, abortSignal: AbortSignal): AsyncGenerator<zDataPart, void, unknown> {
        if (!settings.apiKey) throw new SettingsError();

        const client = this.getClient(settings);

        console.log("Calling Claude");
        const stream = await client.messages.create({
            model: config.model,
            max_tokens: 1024,
            stream: true,
            system: instruction,
            messages: [...context.flatMap(m => {
                const messages: MessageParam[] = [];

                const content: ContentBlockParam[] = [];
                for (const dataPart of m.data) {
                    if (dataPart.type === "file") {
                        if (dataPart.url.startsWith("data:image/")) {
                            content.push({
                                type: "image",
                                source: {
                                    type: "base64",
                                    mediaType: dataPart.url.slice(5, dataPart.url.indexOf(";")),
                                    data: dataPart.url.slice(dataPart.url.indexOf(",") + 1)
                                }
                            } satisfies ImageBlockParam);
                        }
                    }
                    if (dataPart.type === "text") {
                        content.push({
                            type: "text",
                            text: dataPart.value
                        } satisfies TextBlockParam);
                    }
                }
                messages.push({
                    role: m.author === Author.USER ? "user" : "assistant",
                    content
                } satisfies MessageParam);

                return messages;
            })]
        }, {signal: abortSignal});
        console.log("Claude Stream: ", stream);

        let currentThought = "";
        for await (const chunk of stream) {
            console.log("Claude Chunk: ", chunk);

            if (chunk.type === "content_block_start") {
                if (chunk.content_block.type === "thinking") {
                    yield {type: "thought", value: currentThought};
                    currentThought = "";
                } else if (chunk.content_block.type === "text") {
                    if (currentThought.length) {
                        yield {type: "thought", value: currentThought};
                        currentThought = "";
                    }
                }
            } else if (chunk.type === "content_block_delta") {
                if (chunk.delta.type === "thinking_delta") {
                    currentThought += chunk.delta.thinking;
                } else if (chunk.delta.type === "text_delta") {
                    yield {type: "text", value: chunk.delta.text};
                }
            }
        }
    }

    async embed(_settings: any, _texts: string[], _config: any): Promise<number[][]> {
        return [];
    }
}