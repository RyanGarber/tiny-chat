import type {MessageUnomitted, Model, ModelArg, Stream, zConfig, zData} from "../types.ts";
import {zMetadata} from "../types.ts";
import {type Content, GoogleGenAI, type Part, type SendMessageParameters, ThinkingLevel} from "@google/genai";
import {Author} from "../generated/prisma/enums.ts";
import {type ServiceRunner, SettingsError} from "./index.ts";

export class GoogleAiStudio implements ServiceRunner {
    name = "google-ai-studio";
    settings = ["apiKey"];

    async getModels(settings: any): Promise<Model[]> {
        if (!settings.apiKey) return [];

        const models = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`,
        );

        return (await models.json()).models.map((m: any) => {
            const args: ModelArg[] = [
                {name: "temperature", type: "range", min: 0, max: 2, step: 0.05, default: 1},
                ...(m.name.includes("gemini-2.5") ? [
                    {
                        name: "thinking",
                        type: "list",
                        values: ["off", "low", "medium", "high", "auto"],
                        default: "auto"
                    } as ModelArg
                ] : []),
                ...(m.name.includes("gemini-3") ? [
                    {
                        name: "thinking",
                        type: "list",
                        values: ["minimal", "low", "medium", "high", "auto"],
                        default: "auto"
                    } as ModelArg
                ] : []),
            ];
            return {
                name: m.name.split("/").pop(),
                features: [...(m.supportedGenerationMethods.includes("generateContent") ? ["generate" as const] : []), ...(m.supportedGenerationMethods.includes("embedContent") ? ["embed" as const] : [])],
                args
            } satisfies Model;
        });
    }

    async* generate(settings: any, instruction: string, context: MessageUnomitted[], config: zConfig, abortSignal: AbortSignal): Stream {
        if (!settings.apiKey) throw new SettingsError();

        const client = new GoogleGenAI({apiKey: settings.apiKey});

        const boxMessage = (m: MessageUnomitted): Content => {
            const parts: Part[] = [];
            for (const dataPart of m.data) {
                if (dataPart.type === "text") {
                    parts.push({text: dataPart.value});
                }
                if (dataPart.type === "file") {
                    if (dataPart.url.startsWith("data:image/")) {
                        parts.push({
                            inlineData: {
                                mimeType: dataPart.mime,
                                data: dataPart.url.split(";")[1].replace("base64,", "")
                            }
                        });
                    }
                }
            }
            return {
                role: m.author === Author.USER ? "user" : "model",
                parts
            }
        }

        const params: SendMessageParameters = {message: boxMessage(context[context.length - 1]).parts!};

        params.config = {
            abortSignal,
            temperature: config.args.temperature as number,
            enableEnhancedCivicAnswers: true
        };

        if (config.schema) {
            params.config.responseMimeType = "application/json";
            params.config.responseJsonSchema = config.schema;
        }

        if (config.model.includes("-image") || config.model.includes("gemini-3")) {
            params.config.responseModalities = ["TEXT", "IMAGE"];
        }

        if (config.model.startsWith("gemini-") && !config.model.includes("-image")) {
            params.config.systemInstruction = instruction;
            params.config.thinkingConfig = {includeThoughts: true};
            params.config.tools = [{googleSearch: {}, codeExecution: {}}];

            if (config.model.includes("-2.5")) {
                params.config.thinkingConfig.thinkingBudget = ({
                    off: 0,
                    low: 5000,
                    medium: 10000,
                    high: 15000,
                    auto: -1
                })[(config.args.thinking ?? "auto") as string];
            } else if (config.model.includes("-3")) {
                params.config.thinkingConfig.thinkingLevel = ({
                    minimal: ThinkingLevel.MINIMAL,
                    low: ThinkingLevel.LOW,
                    medium: ThinkingLevel.MEDIUM,
                    high: ThinkingLevel.HIGH,
                    auto: ThinkingLevel.THINKING_LEVEL_UNSPECIFIED
                })[(config.args.thinking ?? "auto") as string];
            }
        } else {
            console.log("Model doesn't support system instructions; injecting into history...");
            (context[0].data as zData).unshift({type: "text", value: instruction});
        }

        const response = await client.chats.create({
            model: config.model,
            history: context.slice(0, context.length - 1).map(boxMessage),
        }).sendMessageStream(params);

        const parts: Part[] = [];

        try {
            for await (const chunk of response) {
                if (!chunk.candidates?.length || !chunk.candidates[0].content?.parts) continue;
                for (const part of chunk.candidates[0].content.parts) {
                    if (part.text) {
                        if (part.thought) {
                            yield {type: "thought", value: part.text}
                        } else {
                            yield {type: "text", value: part.text}
                        }
                    }
                    if (part.inlineData) {
                        yield {
                            type: "file",
                            name: part.inlineData.displayName,
                            mime: part.inlineData.mimeType,
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`!,
                            inline: true
                        }
                    }
                    parts.push(part);
                }
            }
        } catch (e: any) {
            if (e?.name?.includes("AbortError")) return;
            throw e;
        }

        yield {type: "metadata", value: zMetadata.parse(parts)};
    }

    async embed(settings: any, texts: string[], config: zConfig): Promise<number[][]> {
        if (!settings.apiKey) return [];

        const client = new GoogleGenAI({apiKey: settings.apiKey});

        const response = await client.models.embedContent({
            model: config.model,
            contents: texts
        });

        return response.embeddings?.map(e => e.values ?? []) ?? [];
    }
}
