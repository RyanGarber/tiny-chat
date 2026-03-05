import type {MessageUnomitted, Model, ModelArg, zConfig, zData, zGenerateOutput} from "../types.ts";
import {zMetadata} from "../types.ts";
import OpenAI, {APIUserAbortError} from "openai";
import type {
    ResponseCreateParamsStreaming,
    ResponseInputContent,
    ResponseInputItem,
    ResponseStreamEvent
} from "openai/resources/responses/responses";
import {type ChatCompletionContentPart} from "openai/resources/chat/completions";
import {Author} from "../generated/prisma/enums.ts";
import {type ServiceRunner, SettingsError} from "./index.ts";

export class MicrosoftFoundry implements ServiceRunner {
    name = "microsoft-foundry";
    settings = ["resourceId", "projectId", "apiKey"];

    private getClient(settings: any) {
        return new OpenAI({
            baseURL: `https://${settings.resourceId}.openai.azure.com/openai/v1/`,
            apiKey: settings.apiKey,
        });
    }

    private usesResponsesApi(model: string) {
        return ["gpt-4", "gpt-5", "o3", "o4"].some(m => model.includes(m));
    }

    // ── Input: zData → Responses API types ─────────────────────────

    private toResponsesContent(data: zData, author: Author): ResponseInputContent[] {
        return data.flatMap((part): ResponseInputContent[] => {
            if (part.type === "text") {
                return [{
                    type: author === Author.USER ? "input_text" : "output_text" as any,
                    text: part.value
                }];
            }
            if (part.type === "file" && part.url.startsWith("data:image/")) {
                return [{
                    type: "input_image",
                    detail: "auto",
                    image_url: part.url
                }];
            }
            return [];
        });
    }

    private toResponsesInput(context: MessageUnomitted[], instruction: string): ResponseInputItem[] {
        return [
            {
                type: "message",
                role: "system",
                content: [{type: "input_text", text: instruction}]
            },
            ...context.map(m => ({
                type: "message" as const,
                role: m.author === Author.USER ? "user" as const : "assistant" as const,
                content: this.toResponsesContent(m.data, m.author)
            }))
        ];
    }

    // ── Input: zData → Completions API types ───────────────────────

    private toCompletionsContent(data: zData): ChatCompletionContentPart[] {
        return data.flatMap((part): ChatCompletionContentPart[] => {
            if (part.type === "text") {
                return [{type: "text", text: part.value}];
            }
            if (part.type === "file" && part.url.startsWith("data:image/")) {
                return [{type: "image_url", image_url: {url: part.url, detail: "auto"}}];
            }
            return [];
        });
    }

    private toCompletionsMessages(context: MessageUnomitted[], instruction: string) {
        return [
            {role: "system" as const, content: instruction},
            ...context.map(m => ({
                role: m.author === Author.USER ? "user" as const : "assistant" as const,
                content: this.toCompletionsContent(m.data)
            } as any))
        ];
    }

    // ── Output: Responses API stream → zGenerateOutput ─────────────

    private async *fromResponsesStream(
        stream: AsyncIterable<ResponseStreamEvent>
    ): AsyncGenerator<zGenerateOutput> {
        const events: ResponseStreamEvent[] = [];
        let currentThought = "";
        let currentThoughtIndex = -1;

        try {
            for await (const chunk of stream) {
                events.push(chunk);

                if (chunk.type.startsWith("response.reasoning_summary_text")) {
                    if (chunk.type === "response.reasoning_summary_text.delta") {
                        if (chunk.summary_index !== currentThoughtIndex && currentThoughtIndex !== -1) {
                            yield {type: "data", value: {type: "thought", value: currentThought}};
                            currentThought = "";
                        }
                        currentThought += chunk.delta;
                        currentThoughtIndex = chunk.summary_index;
                    } else if (chunk.type === "response.reasoning_summary_text.done") {
                        yield {type: "data", value: {type: "thought", value: currentThought}};
                        currentThought = "";
                        currentThoughtIndex = -1;
                    }
                } else if (chunk.type === "response.output_text.delta") {
                    yield {type: "data", value: {type: "text", value: chunk.delta}};
                } else if (chunk.type === "response.image_generation_call.in_progress") {
                    yield {
                        type: "data",
                        value: {type: "file", name: chunk.item_id, url: "/placeholder.png", inline: true}
                    };
                } else if (chunk.type === "response.image_generation_call.partial_image") {
                    yield {
                        type: "special", value: {
                            type: "fileUpdate",
                            name: chunk.item_id,
                            url: `data:image/png;base64,${chunk.partial_image_b64}`
                        }
                    };
                } else if (chunk.type === "response.output_item.done" && chunk.item.type === "image_generation_call") {
                    yield {
                        type: "special", value: {
                            type: "fileUpdate",
                            name: chunk.item.id,
                            url: `data:image/png;base64,${chunk.item.result}`
                        }
                    };
                }
            }
        } catch (e: any) {
            if (e instanceof APIUserAbortError) return;
            throw e;
        }

        yield {
            type: "special", value: {
                type: "metadata",
                value: zMetadata.parse(events.filter(
                    e => e.type !== "response.output_text.delta" && e.type !== "response.reasoning_summary_text.delta"
                ))
            }
        };
    }

    // ── Output: Completions API stream → zGenerateOutput ───────────

    private async *fromCompletionsStream(
        stream: AsyncIterable<any>
    ): AsyncGenerator<zGenerateOutput> {
        const chunks: any[] = [];

        try {
            for await (const chunk of stream) {
                chunks.push(chunk);
                if (!chunk.choices?.[0]?.delta?.content) continue;
                yield {type: "data", value: {type: "text", value: chunk.choices[0].delta.content}};
            }
        } catch (e: any) {
            if (e instanceof APIUserAbortError) return;
            throw e;
        }

        yield {type: "special", value: {type: "metadata", value: zMetadata.parse(chunks)}};
    }

    // ── Model listing ──────────────────────────────────────────────

    async getModels(settings: any): Promise<Model[]> {
        if (!settings.resourceId || !settings.projectId || !settings.apiKey) return [];

        const deployments = await fetch(`https://${settings.resourceId}.services.ai.azure.com/api/projects/${settings.projectId}/deployments?api-version=v1`,
            {headers: {"Authorization": `Bearer ${settings.apiKey}`}});

        const json = await deployments.json();
        console.log("Deployments:", json);

        return json.value.map((d: any) => {
            const args: ModelArg[] = [
                {name: "temperature", type: "range", min: 0, max: 2, step: 0.05, default: 1},
                ...(d.name.includes("gpt-5") || d.name.includes("reasoning")) ? [
                    {
                        name: "reasoning",
                        type: "list" as const,
                        values: ["low", "medium", "high"],
                        default: "medium"
                    },
                ] : []
            ];
            return {
                name: d.name,
                features: [...(d.capabilities.chat_completion ? ["generate" as const] : [])],
                args
            } satisfies Model;
        });
    }

    // ── Responses API generation ───────────────────────────────────

    private async *generateResponses(
        client: OpenAI,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal
    ): AsyncGenerator<zGenerateOutput> {
        if (config.schema) instruction += "\n\nSchema: " + JSON.stringify(config.schema);

        const params: ResponseCreateParamsStreaming = {
            model: config.model,
            stream: true,
            temperature: config.args.temperature as number,
            input: this.toResponsesInput(context, instruction)
        };

        if (config.model.includes("gpt-5")) {
            params.reasoning = {effort: config.args.reasoning, summary: "detailed"};
            params.include = ["reasoning.encrypted_content"];
        }

        const stream = await client.responses.create(params, {signal: abortSignal});
        yield* this.fromResponsesStream(stream);
    }

    // ── Completions API generation ─────────────────────────────────

    private async *generateCompletions(
        client: OpenAI,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal
    ): AsyncGenerator<zGenerateOutput> {
        const stream = await client.chat.completions.create({
            model: config.model,
            messages: this.toCompletionsMessages(context, instruction),
            temperature: config.args.temperature as number,
            stream: true,
        }, {signal: abortSignal});

        yield* this.fromCompletionsStream(stream);
    }

    // ── Generation (entry point) ───────────────────────────────────

    async *generate(
        settings: any,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal
    ): AsyncGenerator<zGenerateOutput> {
        if (!settings.resourceId || !settings.projectId || !settings.apiKey) throw new SettingsError();

        const client = this.getClient(settings);

        if (this.usesResponsesApi(config.model)) {
            yield* this.generateResponses(client, instruction, context, config, abortSignal);
        } else {
            yield* this.generateCompletions(client, instruction, context, config, abortSignal);
        }
    }

    async embed(_settings: any, _texts: string[], _config: zConfig): Promise<number[][]> {
        return [];
    }
}
