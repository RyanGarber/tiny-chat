import type {MessageUnomitted, zData, zGenerateOutput} from "../types.ts";
import {zMetadata} from "../types.ts";
import {type ServiceRunner, SettingsError} from "./index.ts";
import {Author} from "../generated/prisma/enums.ts";
import {Anthropic} from "@anthropic-ai/sdk";
import type {
    ContentBlockParam,
    DocumentBlockParam,
    ImageBlockParam,
    MessageCreateParamsStreaming,
    MessageParam,
    TextBlockParam,
    Tool,
    ToolResultBlockParam,
    ToolUseBlockParam
} from "@anthropic-ai/sdk/resources";
import type {ToolRunner} from "../tools/index.ts";


export const AnthropicAI: ServiceRunner = {
    name: "anthropic-ai",
    settings: ["apiKey"],

    async getModels(session) {
        if (!session?.user?.settings?.services?.[this.name].apiKey) return [];

        const client = getClient(session.user.settings.services[this.name]);

        return (await client.models.list()).data.map(m => ({
            name: m.id,
            features: ["generate" as const],
            args: [
                {type: "range", name: "tokens", min: 1, max: 10000, default: 1000, step: 100},
                {type: "range", name: "temperature", min: 0, max: 1, step: 0.05, default: 1},
            ]
        }));
    },

    async* generate(
        session,
        instruction,
        context,
        config,
        abortSignal,
        tools?
    ) {
        if (!session.user.settings.services[this.name].apiKey) throw new SettingsError();

        const client = getClient(session.user.settings.services[this.name]);

        console.log("Calling Claude");

        const params: MessageCreateParamsStreaming = {
            model: config.model,
            stream: true,
            system: instruction,
            messages: toSdkMessages(context),
            max_tokens: parseInt(config.args?.tokens ?? "1000"),
            temperature: config.args?.temperature as number ?? 1,
            ...(tools?.length ? {tools: toSdkTools(tools)} : {})
        };

        const stream = client.messages.stream(params, {signal: abortSignal});
        yield* fromSdkStream(stream);
    },

    async embed(_session, _texts, _config) {
        return [];
    }
}

function getClient(settings: any) {
    return new Anthropic({
        apiKey: settings.apiKey,
    });
}

function toSdkContent(data: zData): ContentBlockParam[] {
    return data.flatMap((part): ContentBlockParam[] => {
        if (part.type === "text") {
            return [{type: "text", text: part.value} satisfies TextBlockParam];
        }
        if (part.type === "file") {
            const mime = part.mime ?? part.url.slice(5, part.url.indexOf(";"));
            const b64 = part.url.slice(part.url.indexOf(",") + 1);
            if (part.url.startsWith("data:image/")) {
                return [{
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mime as any,
                        data: b64
                    }
                } satisfies ImageBlockParam];
            }
            // Non-image files: use document block
            return [{
                type: "document",
                source: {type: "base64", media_type: mime as any, data: b64},
                ...(part.name ? {title: part.name} : {})
            } satisfies DocumentBlockParam];
        }
        if (part.type === "toolCall") {
            return [{
                type: "tool_use",
                id: part.id,
                name: part.name,
                input: part.args ?? {}
            } satisfies ToolUseBlockParam];
        }
        if (part.type === "toolResult") {
            return [{
                type: "tool_result",
                tool_use_id: part.id,
                content: typeof part.value === "string"
                    ? part.value
                    : JSON.stringify(part.value),
                is_error: part.error
            } satisfies ToolResultBlockParam];
        }
        return [];
    });
}

function toSdkMessages(context: MessageUnomitted[]): MessageParam[] {
    return context.map(m => ({
        role: m.author === Author.USER ? "user" as const : "assistant" as const,
        content: toSdkContent(m.data)
    }));
}

async function* fromSdkStream(
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
                } else if (chunk.content_block.type === "tool_use") {
                    // Start of a tool call — will be flushed on content_block_stop
                }
            } else if (chunk.type === "content_block_delta") {
                if (chunk.delta.type === "thinking_delta") {
                    currentThought += chunk.delta.thinking;
                } else if (chunk.delta.type === "text_delta") {
                    yield {type: "data", value: {type: "text", value: chunk.delta.text}};
                }
            } else if (chunk.type === "content_block_stop") {
                // Find the completed block from the message snapshot
                const block = (stream.currentMessage?.content ?? [])[chunk.index];
                if (block?.type === "tool_use") {
                    yield {
                        type: "data", value: {
                            type: "toolCall",
                            id: block.id,
                            name: block.name,
                            args: block.input
                        }
                    };
                }
            }
        }
    } catch (e: any) {
        if (e.name === "AbortError") return;
        throw e;
    }

    yield {type: "special", value: {type: "metadata", value: zMetadata.parse(events)}};
}

function toSdkTools(tools: ToolRunner[]): Tool[] {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Tool["input_schema"]
    }));
}