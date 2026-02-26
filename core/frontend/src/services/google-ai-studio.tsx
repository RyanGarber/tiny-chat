import {ModelArg, Service, Stream} from "@/services/index.ts";
import {Content, GoogleGenAI, Part, SendMessageParameters, ThinkingLevel} from "@google/genai";
import {MessageUnomitted, zConfigType, zDataType, zMetadata} from "@tiny-chat/core-backend/types.ts";
import {useSettings} from "@/managers/settings.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

export class GoogleAiStudioService implements Service {
    name = "google-ai-studio";
    apiKeyFormat = "api-key";

    async getModels(): Promise<string[]> {
        const apiKey = useSettings.getState().getApiKey(this.name);
        if (!apiKey) return [];

        const models = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        return (await models.json()).models.map((model: any) =>
            model.name.split("/").pop(),
        );
    }

    getArgs(model: string): ModelArg[] {
        return [
            {name: "temperature", type: "range", min: 0, max: 2, step: 0.05, default: 1},
            ...(model.includes("gemini-2.5")) ? [
                {
                    name: "thinking",
                    type: "list",
                    values: ["off", "low", "medium", "high", "auto"],
                    default: "auto"
                } as ModelArg
            ] : [],
            ...(model.includes("gemini-3")) ? [
                {
                    name: "thinking",
                    type: "list",
                    values: ["minimal", "low", "medium", "high", "auto"],
                    default: "auto"
                } as ModelArg
            ] : [],
        ]
    }

    getFeatures(_model: string): string[] {
        return ["schema"];
    }

    async* generate(instruction: string, context: MessageUnomitted[], config: zConfigType, abortSignal: AbortSignal): Stream {
        const apiKey = useSettings.getState().getApiKey(this.name);
        if (!apiKey) return;

        const client = new GoogleGenAI({apiKey});

        const boxMessage = (m: MessageUnomitted): Content => {
            const parts: Part[] = [];
            for (const dataPart of m.data) {
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
                if (dataPart.type === "text") {
                    parts.push({text: dataPart.value});
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
            enableEnhancedCivicAnswers: true,
            tools: [{googleSearch: {}, codeExecution: {}}] // TODO - file_search
        };

        if (config.args.schema) {
            params.config.responseMimeType = "application/json";
            params.config.responseJsonSchema = config.args.schema;
        }

        if (config.model.startsWith("gemini-")) {
            params.config.systemInstruction = instruction;
            params.config.thinkingConfig = {includeThoughts: true};
            if (config.model.includes("2.5")) {
                params.config.thinkingConfig.thinkingBudget = ({
                    off: 0,
                    low: 5000,
                    medium: 10000,
                    high: 15000,
                    auto: -1
                })[(config.args.thinking ?? "auto") as string];
            } else if (config.model.includes("3")) {
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
            (context[0].data as zDataType).unshift({type: "text", value: instruction});
        }

        const response = await client.chats.create({
            model: config.model,
            history: context.slice(0, context.length - 1).map(boxMessage),
        }).sendMessageStream(params);

        const parts: Part[] = [];

        let lastYield = performance.now();

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
                    parts.push(part);
                }

                const now = performance.now();
                if (now - lastYield > 16) {
                    await new Promise<void>(r => setTimeout(r, 0));
                    lastYield = performance.now();
                }
            }
        } catch (e: any) {
            if (e?.name?.includes("AbortError")) return;
            throw e;
        }

        // TODO - combine deltas for efficiency (less needed than foundry but still)
        yield {metadata: zMetadata.parse(parts)};
    }

    async embed(texts: string[], config: zConfigType): Promise<number[][]> {
        const apiKey = useSettings.getState().getApiKey(this.name);
        if (!apiKey) return [];

        const client = new GoogleGenAI({apiKey});

        const response = await client.models.embedContent({
            model: config.model,
            contents: texts
        });

        return response.embeddings?.map(e => e.values ?? []) ?? [];
    }
}
