import type {MessageUnomitted, Model, ModelArg, zConfig, zGenerateOutput} from "../types.ts";
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

    async* generate(settings: any, instruction: string, context: MessageUnomitted[], config: zConfig, abortSignal: AbortSignal): AsyncGenerator<zGenerateOutput> {
        if (!settings.resourceId || !settings.projectId || !settings.apiKey) throw new SettingsError();

        const azure = new OpenAI({
            baseURL: `https://${settings.resourceId}.openai.azure.com/openai/v1/`,
            apiKey: settings.apiKey,
        });

        if (config.schema) instruction += "\n\nSchema: " + JSON.stringify(config.schema);

        /************************* RESPONSES API **************************/

        if (["gpt-4", "gpt-5", "o3", "o4"].some(m => config.model.includes(m))) {
            let params: ResponseCreateParamsStreaming = {
                model: config.model,
                stream: true,
                temperature: config.args.temperature as number,
                input: [
                    {
                        type: "message",
                        role: "system",
                        content: [{type: "input_text", text: instruction}]
                    },
                    ...context.flatMap(m => {
                        const inputs: ResponseInputItem[] = [];

                        const content: ResponseInputContent[] = [];
                        for (const dataPart of m.data) {
                            if (dataPart.type === "file") {
                                if (dataPart.url.startsWith("data:image/")) {
                                    content.push({
                                        type: "input_image",
                                        detail: "auto",
                                        image_url: dataPart.url
                                    });
                                }
                            }
                            if (dataPart.type === "text") {
                                content.push({
                                    type: m.author === Author.USER ? "input_text" : "output_text" as any,
                                    text: dataPart.value
                                });
                            }
                        }
                        inputs.push({
                            type: "message",
                            role: m.author === Author.USER ? "user" : "assistant",
                            content
                        });

                        return inputs;
                    })
                ]
            };
            if (config.model.includes("gpt-5")) {
                params.reasoning = {effort: config.args.reasoning, summary: "detailed"};
                params.include = ["reasoning.encrypted_content"];
            }

            const response = await azure.responses.create(params, {signal: abortSignal});

            const events: ResponseStreamEvent[] = [];
            let currentThought = "";
            let currentThoughtIndex = -1;

            try {
                for await (const chunk of response) {
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
                        }
                    } else if (chunk.type === "response.output_item.done" && chunk.item.type === "image_generation_call") {
                        yield {
                            type: "special", value: {
                                type: "fileUpdate",
                                name: chunk.item.id,
                                url: `data:image/png;base64,${chunk.item.result}`
                            }
                        }
                    }
                    events.push(chunk);
                }
            } catch (e: any) {
                if (e instanceof APIUserAbortError) return;
                throw e;
            }

            yield {
                type: "special", value: {
                    type: "metadata",
                    value: zMetadata.parse(events.filter(e => e.type !== "response.output_text.delta" && e.type !== "response.reasoning_summary_text.delta"))
                }
            };
        }

        /************************* COMPLETIONS API **************************/
        else {
            const response = await azure.chat.completions.create({
                model: config.model,
                messages: [
                    {role: "system", content: instruction},
                    ...context.map(m => {
                        const parts: ChatCompletionContentPart[] = [];
                        for (const dataPart of m.data) {
                            if (dataPart.type === "text") {
                                parts.push({type: "text", text: dataPart.value});
                            }
                        }
                        return {role: m.author === Author.USER ? "user" : "assistant", content: parts} as any;
                    })
                ],
                stream: true,
            }, {signal: abortSignal});

            const chunks = [];

            try {
                for await (const chunk of response) {
                    if (!chunk.choices?.[0]?.delta?.content) continue;
                    const content = chunk.choices[0].delta.content;
                    yield {type: "data", value: {type: "text", value: content}};
                    chunks.push(chunk);
                }
            } catch (e: any) {
                if (e instanceof APIUserAbortError) return;
                throw e;
            }

            yield {type: "special", value: {type: "metadata", value: zMetadata.parse(chunks)}};
        }
    }

    async embed(_settings: any, _texts: string[], _config: zConfig): Promise<number[][]> {
        return [];
    }
}
