import type {MessageUnomitted, Model, zConfig, zData, zGenerateOutput} from "../types.ts";
import {zMetadata} from "../types.ts";
import {type ServiceRunner, SettingsError} from "./index.ts";
import {Author} from "../generated/prisma/enums.ts";
import {Anthropic} from "@anthropic-ai/sdk";
import type {
    ContentBlockParam,
    ImageBlockParam,
    MessageCreateParamsStreaming,
    MessageParam,
    TextBlockParam
} from "@anthropic-ai/sdk/resources";


export class AnthropicAi implements ServiceRunner {
    name = "anthropic-ai";
    settings = ["apiKey"];

    private getClient(settings: any) {
        return new Anthropic({
            apiKey: settings.apiKey,
        });
    }

    // ── Input conversion: zData → Anthropic SDK types ──────────────

    private toSdkContent(data: zData): ContentBlockParam[] {
        return data.flatMap((part): ContentBlockParam[] => {
            if (part.type === "text") {
                return [{type: "text", text: part.value} satisfies TextBlockParam];
            }
            if (part.type === "file" && part.url.startsWith("data:image/")) {
                return [{
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: part.url.slice(5, part.url.indexOf(";")) as any,
                        data: part.url.slice(part.url.indexOf(",") + 1)
                    }
                } satisfies ImageBlockParam];
            }
            return [];
        });
    }

    private toSdkMessages(context: MessageUnomitted[]): MessageParam[] {
        return context.map(m => ({
            role: m.author === Author.USER ? "user" as const : "assistant" as const,
            content: this.toSdkContent(m.data)
        }));
    }

    // ── Output conversion: Anthropic SDK stream → zGenerateOutput ──

    private async *fromSdkStream(
        stream: ReturnType<Anthropic["messages"]["stream"]>
    ): AsyncGenerator<zGenerateOutput> {
        let currentThought = "";
        const events: any[] = [];

        try {
            for await (const chunk of stream) {
                events.push(chunk);

                if (chunk.type === "content_block_start") {
                    if (chunk.content_block.type === "thinking") {
                        yield {type: "data", value: {type: "thought", value: currentThought}};
                        currentThought = "";
                    } else if (chunk.content_block.type === "text") {
                        if (currentThought.length) {
                            yield {type: "data", value: {type: "thought", value: currentThought}};
                            currentThought = "";
                        }
                    }
                } else if (chunk.type === "content_block_delta") {
                    if (chunk.delta.type === "thinking_delta") {
                        currentThought += chunk.delta.thinking;
                    } else if (chunk.delta.type === "text_delta") {
                        yield {type: "data", value: {type: "text", value: chunk.delta.text}};
                    }
                }
            }
        } catch (e: any) {
            if (e.name === "AbortError") return;
            throw e;
        }

        yield {type: "special", value: {type: "metadata", value: zMetadata.parse(events)}};
    }

    // ── Model listing ──────────────────────────────────────────────

    async getModels(settings: any): Promise<Model[]> {
        if (!settings.apiKey) return [];

        const client = this.getClient(settings);

        return (await client.models.list()).data.map(m => ({
            name: m.id,
            features: ["generate" as const],
            args: [
                {type: "range", name: "tokens", min: 1, max: 10000, default: 1000, step: 100},
                {type: "range", name: "temperature", min: 0, max: 1, step: 0.05, default: 1},
            ]
        }));
    }

    // ── Generation ─────────────────────────────────────────────────

    async *generate(
        settings: any,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal
    ): AsyncGenerator<zGenerateOutput> {
        if (!settings.apiKey) throw new SettingsError();

        const client = this.getClient(settings);

        console.log("Calling Claude");

        const params: MessageCreateParamsStreaming = {
            model: config.model,
            stream: true,
            system: instruction,
            messages: this.toSdkMessages(context),
            max_tokens: parseInt(config.args?.tokens ?? "1000"),
            temperature: config.args?.temperature as number ?? 1,
        };

        const stream = client.messages.stream(params, {signal: abortSignal});
        yield* this.fromSdkStream(stream);
    }

    async embed(_settings: any, _texts: string[], _config: any): Promise<number[][]> {
        return [];
    }
}
