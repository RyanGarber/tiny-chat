import type {MessageUnomitted, Model, ModelArg, zConfig, zData, zGenerateOutput} from "../../types.ts";
import {zMetadata} from "../../types.ts";
import {
    type Content,
    type FunctionDeclaration,
    GoogleGenAI,
    type Part,
    type SendMessageParameters,
    ThinkingLevel
} from "@google/genai";
import {Author} from "../../generated/prisma/enums.ts";
import {type ChatProvider, SettingsError} from "./index.ts";
import type {CustomTool} from "../../tools/index.ts";

export const GoogleAIStudio: ChatProvider = {
    name: "google-ai-studio",
    settings: ["apiKey"],

    async getModels(session) {
        if (!session?.user?.settings?.services?.[this.name].apiKey) return [];

        const models = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${session.user.settings.services[this.name].apiKey}`,
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
                features: [
                    ...(m.supportedGenerationMethods.includes("generateContent") ? ["generate" as const] : []),
                    ...(m.supportedGenerationMethods.includes("embedContent") ? ["embed" as const] : [])
                ],
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
        if (!session.user.settings.services[this.name].apiKey) throw new SettingsError();

        const client = new GoogleGenAI({apiKey: session.user.settings.services[this.name].apiKey});

        const params: SendMessageParameters = {
            message: toSdkContent(context[context.length - 1], config).parts!
        };

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
            params.config.tools = [
                //{googleSearch: {}, codeExecution: {}}, - TODO - disabling search+code just for a model that can't send a GOD DAMN TOOL ARG?!
                ...(tools?.length ? [{functionDeclarations: toSdkTools(tools)}] : [])
            ];

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
            // Models without system instruction support: inject into first message's history
            console.log("Model doesn't support system instructions; injecting into history");
            (context[0].data as zData).unshift({type: "text", value: instruction});
        }

        const stream = await client.chats.create({
            model: config.model,
            history: context.slice(0, context.length - 1).map(m => toSdkContent(m, config)),
        }).sendMessageStream(params);

        yield* fromSdkStream(stream);
    },

    async embed(session, texts, config) {
        if (!session.user.settings.services[this.name].apiKey) return [];

        const client = new GoogleGenAI({apiKey: session.user.settings.services[this.name].apiKey});

        const response = await client.models.embedContent({
            model: config.model,
            contents: texts
        });

        return response.embeddings?.map(e => e.values ?? []) ?? [];
    }
}

function stripUnsupportedFields(schema: any): any {
    if (typeof schema !== "object" || schema === null) return schema;
    // Google's API does not support $schema or additionalProperties —
    // their presence causes the entire parameter schema to be silently dropped.
    const {$schema, additionalProperties, ...rest} = schema;
    return Object.fromEntries(
        Object.entries(rest).map(([k, v]) =>
            [k, Array.isArray(v) ? v : typeof v === "object" ? stripUnsupportedFields(v) : v]
        )
    );
}

function toSdkTools(tools: CustomTool[]): FunctionDeclaration[] {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: stripUnsupportedFields(t.parameters)
    }));
}

function toSdkContent(message: MessageUnomitted, config: zConfig): Content {
    const isSameModel = message.config?.model === config.model;
    return {
        role: message.author === Author.USER ? "user" : "model",
        parts: message.data.flatMap((part): Part[] => {
            if (part.type === "text") {
                return [{text: part.value}];
            }
            if (part.type === "thought" && isSameModel) {
                const match = message.metadata.flat().find(p => p.thought && p.thoughtSignature);
                return [{
                    thought: true,
                    thoughtSignature: match?.thoughtSignature ?? "skip_thought_signature_validator",
                    text: part.value
                }];
            }
            if (part.type === "file") {
                const mime = part.mime ?? part.url.slice(5, part.url.indexOf(";"));
                const b64 = part.url.split(";base64,")[1] ?? part.url.slice(part.url.indexOf(",") + 1);
                return [{inlineData: {mimeType: mime, data: b64}}];
            }
            if (part.type === "toolCall") {
                const match = message.metadata.flat().find(p => p.functionCall?.name === part.name && p.functionCall?.id === part.id && p.thoughtSignature);
                return [{
                    functionCall: {
                        id: part.id,
                        name: part.name,
                        args: part.args ?? {},
                    },
                    thoughtSignature: match?.thoughtSignature ?? "skip_thought_signature_validator",
                }];
            }
            if (part.type === "toolResult") {
                return [{
                    functionResponse: {
                        id: part.id,
                        name: part.name,
                        response: {
                            result: !part.error ? part.value : undefined,
                            error: part.error ? part.value : undefined
                        }
                    }
                }];
            }
            return [];
        })
    };
}

async function* fromSdkStream(
    stream: AsyncIterable<any>
): AsyncGenerator<zGenerateOutput> {
    const parts: Part[] = [];

    try {
        for await (const chunk of stream) {
            if (!chunk.candidates?.length || !chunk.candidates[0].content?.parts) continue;

            for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                    if (part.thought) {
                        yield {type: "data", value: {type: "thought", value: part.text}};
                    } else {
                        yield {type: "data", value: {type: "text", value: part.text}};
                    }
                }
                if (part.inlineData) {
                    yield {
                        type: "data", value: {
                            type: "file",
                            name: part.inlineData.displayName,
                            mime: part.inlineData.mimeType,
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`!,
                            inline: true
                        }
                    };
                }
                if (part.functionCall) {
                    yield {
                        type: "data", value: {
                            type: "toolCall",
                            id: part.functionCall.id ?? part.functionCall.name,
                            name: part.functionCall.name,
                            args: part.functionCall.args ?? {},
                        }
                    };
                }
                parts.push(part);
            }
        }
    } catch (e: any) {
        if (e?.name?.includes("AbortError")) return;
        throw e;
    }

    yield {type: "special", value: {type: "metadata", value: zMetadata.parse(parts)}};
}