import {ModelArg, Service} from "@/services/index.ts";
import {MessageUnomitted, zConfigType, zMetadata} from "@tiny-chat/core-backend/types.ts";
import {useSettings} from "@/managers/settings.tsx";
import {alert} from "@/utils.ts";

import OpenAI from "openai";
import {
    ResponseCreateParamsStreaming,
    ResponseInputContent,
    ResponseInputItem,
    ResponseStreamEvent
} from "openai/resources/responses/responses";
import {ChatCompletionContentPart} from "openai/resources/chat/completions";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

export class MicrosoftFoundryService implements Service {
    name = "microsoft-foundry";
    apiKeyFormat = "resource;project;api-key";

    async getModels(): Promise<string[]> {
        const {resource, project, apiKey} = this.getKeys();
        if (!resource || !project || !apiKey) return [];
        const deployments = await fetch(`https://${resource}.services.ai.azure.com/api/projects/${project}/deployments?api-version=v1`,
            {headers: {"Authorization": `Bearer ${apiKey}`}});
        console.log("Deployments:", deployments);
        return (await deployments.json()).value.map((d: any) => d.name);
    }

    getArgs(model: string): ModelArg[] {
        return [
            {name: "temperature", type: "range", min: 0, max: 2, step: 0.05, default: 1},
            ...(model.includes("gpt-5") || model.includes("reasoning")) ? [
                {
                    name: "reasoning",
                    type: "list",
                    values: ["none", "minimal", "low", "medium", "high", "maximal"],
                    default: "none"
                } as ModelArg,
            ] : []
        ];
    }

    async* callModel(instruction: string, context: MessageUnomitted[], config: zConfigType): AsyncGenerator<any> {
        const {resource, apiKey} = this.getKeys();
        const azure = new OpenAI({
            baseURL: `https://${resource}.openai.azure.com/openai/v1/`,
            apiKey,
            dangerouslyAllowBrowser: true,
        });

        /************************* RESPONSES API **************************/

        if (["gpt-4", "gpt-5", "o3", "o4"].some(m => config.model.includes(m))) {
            let params: ResponseCreateParamsStreaming = {
                model: config.model,
                stream: true,
                temperature: config.args.temperature as number,
                tools: [
                    //{type: "web_search"}, TODO - causes freeze
                    {type: "code_interpreter", container: {type: "auto"}}
                ], // TODO - file_search, image_generation
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
            if (["gpt-5", "reasoning", "thinking"].some(m => config.model.includes(m))) {
                console.log("Enabling reasoning (medium effort)");
                params.reasoning = {effort: "medium", summary: "detailed"};
                params.include = ["reasoning.encrypted_content"];
            }

            const response = await azure.responses.create(params);

            const events: ResponseStreamEvent[] = [];
            let currentThought = "";
            let currentThoughtIndex = -1;

            for await (const chunk of response) {
                console.log("Received response event:", chunk.type);
                // Incoming Thoughts
                if (chunk.type.startsWith("response.reasoning_summary_text")) {
                    if (chunk.type === "response.reasoning_summary_text.delta") {
                        if (chunk.summary_index !== currentThoughtIndex && currentThoughtIndex !== -1) {
                            yield {type: "thought", value: currentThought};
                            currentThought = "";
                        }
                        currentThought += chunk.delta;
                        currentThoughtIndex = chunk.summary_index;
                    } else if (chunk.type === "response.reasoning_summary_text.done") {
                        yield {type: "thought", value: currentThought};
                        currentThought = "";
                        currentThoughtIndex = -1;
                    }
                }
                // Incoming Text
                else if (chunk.type === "response.output_text.delta") {
                    yield {type: "text", value: chunk.delta};
                }
                events.push(chunk);
            }

            yield {metadata: zMetadata.parse(events.filter(e => e.type !== "response.output_text.delta" && e.type !== "response.reasoning_summary_text.delta"))}
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
                stream: true
            });

            const chunks = [];

            for await (const chunk of response) {
                console.log("Received completion chunk:", chunk);
                if (!chunk.choices?.[0]?.delta?.content) continue;
                const content = chunk.choices[0].delta.content;
                yield {type: "text", value: content};
                chunks.push(chunk);
            }

            yield {metadata: zMetadata.parse(chunks)};
        }
    }

    getKeys() {
        const apiKeyRaw = useSettings.getState().getApiKey(this.name);
        const [resource, project, apiKey] = apiKeyRaw?.split(';') || [];
        if (apiKeyRaw && (!resource || !project || !apiKey)) alert("warning", "Invalid Microsoft Foundry API key format");
        return {resource, project, apiKey};
    }
}