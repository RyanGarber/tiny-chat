import type {MessageUnomitted, Model, ModelArg, zConfig, zData, zDataPart, zGenerateOutput} from "../../types.ts";
import {zMetadata} from "../../types.ts";
import OpenAI, {APIUserAbortError} from "openai";
import type {
    FunctionTool,
    ResponseCreateParamsStreaming,
    ResponseInputContent,
    ResponseInputItem,
    ResponseStreamEvent
} from "openai/resources/responses/responses";
import {
    type ChatCompletionContentPart,
    type ChatCompletionMessageParam,
    type ChatCompletionTool
} from "openai/resources/chat/completions";
import {Author} from "../../generated/prisma/enums.ts";
import {type ChatProvider, SettingsError} from "./index.ts";
import type {CustomTool} from "../../tools/index.ts";
import {splitToolResults} from "../../generate.ts";

export const MicrosoftFoundry: ChatProvider = {
    name: "microsoft-foundry",
    settings: ["resourceId", "projectId", "apiKey"],

    async getModels(session) {
        const settings = session?.user?.settings?.services?.[this.name];
        if (!settings?.resourceId || !settings?.projectId || !settings?.apiKey) return [];

        const deployments = await fetch(`https://${settings.resourceId}.services.ai.azure.com/api/projects/${settings.projectId}/deployments?api-version=v1`,
            {headers: {"Authorization": `Bearer ${settings.apiKey}`}});

        const json = await deployments.json();
        console.log("gpt-5.3-chat capabilities:", json.value.find((d: any) => d.name === "gpt-5.3-chat")?.capabilities);

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
    },

    async* generate(
        session,
        instruction,
        context,
        config,
        abortSignal,
        tools?
    ) {
        const settings = session.user.settings.services[this.name];
        if (!settings.resourceId || !settings.projectId || !settings.apiKey) throw new SettingsError();

        const client = getClient(settings);

        context = splitToolResults(context);
        if (usesResponsesApi(config.model)) {
            yield* generateResponses(client, instruction, context, config, abortSignal, tools);
        } else {
            yield* generateCompletions(client, instruction, context, config, abortSignal, tools);
        }
    },

    async embed(_session, _texts, _config) {
        return [];
    }
}

function getClient(settings: any) {
    return new OpenAI({
        baseURL: `https://${settings.resourceId}.openai.azure.com/openai/v1/`,
        apiKey: settings.apiKey,
    });
}

function usesResponsesApi(model: string) {
    return ["gpt-4", "gpt-5", "o3", "o4"].some(m => model.includes(m));
}

function toResponsesContent(data: zData, author: Author): ResponseInputContent[] {
    return data.flatMap((part): ResponseInputContent[] => {
        if (part.type === "text") {
            return [{
                type: author === Author.USER ? "input_text" : "output_text" as any,
                text: part.value
            }];
        }
        if (part.type === "file") {
            if (part.url.startsWith("data:image/")) {
                return [{
                    type: "input_image",
                    detail: "auto",
                    image_url: part.url
                }];
            }
            // Non-image files: pass as inline file
            return [{
                type: "input_file" as any,
                filename: part.name ?? "attachment",
                file_data: part.url
            }];
        }
        return [];
    });
}

function toResponsesInput(context: MessageUnomitted[], instruction: string, config: zConfig): ResponseInputItem[] {
    const items: ResponseInputItem[] = [
        {
            type: "message",
            role: "system",
            content: [{type: "input_text", text: instruction}]
        },
    ];

    for (const m of context) {
        const isSameModel = m.config?.model === config.model;

        if (m.author === Author.MODEL) {
            // Reconstruct reasoning items from thoughts with ids (only if same model)
            if (isSameModel) {
                const thoughtsWithId = m.data.filter(p => p.type === "thought" && p.id);
                for (const thought of thoughtsWithId) {
                    if (thought.type !== "thought" || !thought.id) continue;
                    // Find the matching reasoning item in metadata
                    const reasoningEvent = (m.metadata ?? []).flat().find(
                        (e: any) => e.type === "response.output_item.done" && e.item?.type === "reasoning" && e.item?.id === thought.id
                    );
                    if (reasoningEvent?.item?.encrypted_content) {
                        items.push({
                            type: "reasoning",
                            id: thought.id,
                            summary: reasoningEvent.item.summary ?? [],
                            encrypted_content: reasoningEvent.item.encrypted_content
                        });
                    }
                }
            }

            // Emit tool calls as top-level function_call items
            const toolCalls = m.data.filter(p => p.type === "toolCall");
            const rest = m.data.filter(p => p.type !== "toolCall" && p.type !== "thought");

            if (rest.length) {
                items.push({
                    type: "message",
                    role: "assistant",
                    content: toResponsesContent(rest, Author.MODEL),
                });
            }

            for (const part of toolCalls) {
                if (part.type !== "toolCall") continue;
                items.push({
                    type: "function_call",
                    call_id: part.id,
                    name: part.name,
                    arguments: JSON.stringify(part.args ?? {}),
                });
            }
        } else {
            // User message — may contain tool results and regular content
            const toolResults = m.data.filter(p => p.type === "toolResult");
            const rest = m.data.filter(p => p.type !== "toolResult");

            for (const part of toolResults) {
                if (part.type !== "toolResult") continue;
                items.push({
                    type: "function_call_output",
                    call_id: part.id,
                    output: typeof part.value === "string" ? part.value : JSON.stringify(part.value),
                });
            }

            if (rest.length) {
                items.push({
                    type: "message",
                    role: "user",
                    content: toResponsesContent(rest, Author.USER),
                });
            }
        }
    }

    return items;
}

function toCompletionsContent(data: zData): ChatCompletionContentPart[] {
    return data.flatMap((part): ChatCompletionContentPart[] => {
        if (part.type === "text") {
            return [{type: "text", text: part.value}];
        }
        if (part.type === "file") {
            if (part.url.startsWith("data:image/")) {
                return [{type: "image_url", image_url: {url: part.url, detail: "auto"}}];
            }
            // Non-image files: extract text content or describe the attachment
            const mime = part.mime ?? part.url.slice(5, part.url.indexOf(";"));
            const b64 = part.url.slice(part.url.indexOf(",") + 1);
            if (mime.startsWith("text/")) {
                const text = Buffer.from(b64, "base64").toString("utf-8");
                return [{type: "text", text: `[File: ${part.name ?? "attachment"}]\n${text}`}];
            }
            return [{type: "text", text: `[Attached file: ${part.name ?? "attachment"} (${mime})]`}];
        }
        return [];
    });
}

function toCompletionsMessages(context: MessageUnomitted[], instruction: string): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [
        {role: "system", content: instruction}
    ];

    for (const m of context) {
        if (m.author === Author.USER) {
            // Collect tool results and regular content separately
            const toolResults = m.data.filter((p): p is Extract<zDataPart, {
                type: "toolResult"
            }> => p.type === "toolResult");
            const rest = m.data.filter(p => p.type !== "toolResult");

            if (toolResults.length) {
                for (const tr of toolResults) {
                    messages.push({
                        role: "tool",
                        tool_call_id: tr.id,
                        content: typeof tr.value === "string" ? tr.value : JSON.stringify(tr.value)
                    });
                }
            }
            if (rest.length) {
                messages.push({role: "user", content: toCompletionsContent(rest)});
            }
        } else {
            // Assistant message — may contain tool_calls
            const toolCalls = m.data.filter((p): p is Extract<zDataPart, {
                type: "toolCall"
            }> => p.type === "toolCall");
            const rest = m.data.filter(p => p.type !== "toolCall");
            const assistantMsg: ChatCompletionMessageParam = {
                role: "assistant",
                content: toCompletionsContent(rest) as any,
                ...(toolCalls.length ? {
                    tool_calls: toolCalls.map(p => ({
                        id: p.id,
                        type: "function" as const,
                        function: {name: p.name, arguments: JSON.stringify(p.args ?? {})}
                    }))
                } : {})
            };
            messages.push(assistantMsg);
        }
    }

    return messages;
}

function toCompletionsTools(tools: CustomTool[]): ChatCompletionTool[] {
    return tools.map(t => ({
        type: "function" as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }
    }));
}

async function* fromResponsesStream(
    stream: AsyncIterable<ResponseStreamEvent>
): AsyncGenerator<zGenerateOutput> {
    const events: ResponseStreamEvent[] = [];
    let currentThought = "";
    let currentThoughtIndex = -1;
    let currentReasoningItemId = "";

    // Tool call accumulation
    let currentToolCallId = "";
    let currentToolCallName = "";
    let currentToolCallArgs = "";

    try {
        for await (const chunk of stream) {
            events.push(chunk);

            if (chunk.type === "response.output_item.added" && chunk.item.type === "reasoning") {
                currentReasoningItemId = chunk.item.id;
            }

            if (chunk.type.startsWith("response.reasoning_summary_text")) {
                if (chunk.type === "response.reasoning_summary_text.delta") {
                    if (chunk.summary_index !== currentThoughtIndex && currentThoughtIndex !== -1) {
                        yield {
                            type: "data",
                            value: {type: "thought", id: currentReasoningItemId || undefined, value: currentThought}
                        };
                        currentThought = "";
                    }
                    currentThought += chunk.delta;
                    currentThoughtIndex = chunk.summary_index;
                } else if (chunk.type === "response.reasoning_summary_text.done") {
                    yield {
                        type: "data",
                        value: {type: "thought", id: currentReasoningItemId || undefined, value: currentThought}
                    };
                    currentThought = "";
                    currentThoughtIndex = -1;
                }
            } else if (chunk.type === "response.output_text.delta") {
                yield {type: "data", value: {type: "text", value: chunk.delta}};
            } else if (chunk.type === "response.output_item.added" && chunk.item.type === "function_call") {
                currentToolCallId = chunk.item.call_id;
                currentToolCallName = chunk.item.name;
                currentToolCallArgs = "";
            } else if (chunk.type === "response.function_call_arguments.delta") {
                currentToolCallArgs += chunk.delta;
            } else if (chunk.type === "response.function_call_arguments.done") {
                let args: any = {};
                try {
                    args = JSON.parse(currentToolCallArgs);
                } catch {
                }
                yield {type: "data", value: {type: "toolCall", id: currentToolCallId, name: currentToolCallName, args}};
                currentToolCallId = "";
                currentToolCallName = "";
                currentToolCallArgs = "";
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
                        url: `data:image/png;base64,${chunk.item.status}`
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
                e => e.type !== "response.output_text.delta" && e.type !== "response.reasoning_summary_text.delta" && e.type !== "response.function_call_arguments.delta"
            ))
        }
    };
}

async function* generateCompletions(
    client: OpenAI,
    instruction: string,
    context: MessageUnomitted[],
    config: zConfig,
    abortSignal: AbortSignal,
    tools?: CustomTool[]
): AsyncGenerator<zGenerateOutput> {
    const stream = await client.chat.completions.create({
        model: config.model,
        messages: toCompletionsMessages(context, instruction),
        temperature: config.args.temperature as number,
        stream: true,
        ...(tools?.length ? {tools: toCompletionsTools(tools), tool_choice: "auto"} : {})
    }, {signal: abortSignal});

    yield* fromCompletionsStream(stream);
}

async function* fromCompletionsStream(
    stream: AsyncIterable<any>
): AsyncGenerator<zGenerateOutput> {
    const chunks: any[] = [];
    // Accumulate tool call deltas keyed by index
    const toolCallAccum: Record<number, { id: string; name: string; args: string }> = {};

    try {
        for await (const chunk of stream) {
            chunks.push(chunk);
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                yield {type: "data", value: {type: "text", value: delta.content}};
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (!toolCallAccum[tc.index]) {
                        toolCallAccum[tc.index] = {id: tc.id ?? "", name: tc.function?.name ?? "", args: ""};
                    }
                    if (tc.id) toolCallAccum[tc.index].id = tc.id;
                    if (tc.function?.name) toolCallAccum[tc.index].name += tc.function.name;
                    if (tc.function?.arguments) toolCallAccum[tc.index].args += tc.function.arguments;
                }
            }

            // When the model signals it's done with a tool_calls finish reason, flush them
            if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
                for (const tc of Object.values(toolCallAccum)) {
                    let args: any = {};
                    try {
                        args = JSON.parse(tc.args);
                    } catch {
                    }
                    yield {type: "data", value: {type: "toolCall", id: tc.id, name: tc.name, args}};
                }
            }
        }
    } catch (e: any) {
        if (e instanceof APIUserAbortError) return;
        throw e;
    }

    yield {type: "special", value: {type: "metadata", value: zMetadata.parse(chunks)}};
}

function toResponsesTools(tools: CustomTool[]): FunctionTool[] {
    return tools.map(t => ({
        type: "function" as const,
        name: t.name,
        description: t.description,
        parameters: t.parameters as FunctionTool["parameters"],
        strict: null,
    }));
}

async function* generateResponses(
    client: OpenAI,
    instruction: string,
    context: MessageUnomitted[],
    config: zConfig,
    abortSignal: AbortSignal,
    tools?: CustomTool[]
): AsyncGenerator<zGenerateOutput> {
    if (config.schema) instruction += "\n\nSchema: " + JSON.stringify(config.schema);

    const params: ResponseCreateParamsStreaming = {
        model: config.model,
        stream: true,
        store: false,
        temperature: config.args.temperature as number,
        input: toResponsesInput(context, instruction, config),
        ...(tools?.length ? {tools: toResponsesTools(tools)} : {})
    };

    if (config.model.includes("gpt-5") || config.model.includes("o3") || config.model.includes("o4")) {
        params.reasoning = {effort: config.args.reasoning, summary: "detailed"};
        params.include = ["reasoning.encrypted_content"];
    }

    const stream = await client.responses.create(params, {signal: abortSignal});
    yield* fromResponsesStream(stream);
}