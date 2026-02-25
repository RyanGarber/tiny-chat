import {useChats} from "@/managers/chats.tsx";
import {reloadConfig} from "@/managers/messaging.tsx";
import {services, StreamEnd} from "@/services";
import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {MessageUnomitted, zConfigType, zDataPart, zDataPartType} from "@tiny-chat/core-backend/types.ts";
import {alert, extractText, scrubText, trpc} from "@/utils.ts";
import {useSettings} from "@/managers/settings.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {useMemories} from "@/managers/memories.tsx";

interface Services {
    init: () => Promise<void>;

    services: {
        name: string;
        models: string[];
    }[];
    findService: (name: string) => ReturnType<typeof services.find>;
    findServiceWithModel: (name: string) => Promise<ReturnType<typeof services.find>>;

    fetchServices: () => Promise<void>;

    abortController: AbortController | null;
    prepareConfig: (config: zConfigType) => zConfigType;
    onMessage: (messageId: string) => Promise<void>;
}

export const useServices = create(
    subscribeWithSelector<Services>((set, get) => ({
        init: async () => {
            await get().fetchServices();
        },

        services: [],
        findService: (name) => services.find((s) => s.name === name),
        findServiceWithModel: async (name: string) => {
            for (const service of get().services) {
                if (service.models.includes(name)) {
                    return get().findService(service.name);
                }
            }
        },

        fetchServices: async () => {
            const available = [];

            for (const service of services) {
                try {
                    const models = await service.getModels();
                    available.push({name: service.name, models});
                } catch (e) {
                    alert("error", `Failed to fetch models from ${service.name} (see console)`);
                    throw e;
                }
            }

            console.log("Fetched services:", available);
            set({services: available});
            reloadConfig();
        },

        abortController: null,
        prepareConfig: (config: zConfigType) => {
            const prepared = config;
            for (const arg of get().findService(config.service)!.getArgs(config.model)!) {
                if (prepared.args?.[arg.name] === undefined) {
                    console.log(`Using default value for arg ${arg.name}:`, arg.default)
                    if (prepared.args === undefined) prepared.args = {};
                    prepared.args[arg.name] = arg.default;
                }
            }
            return prepared;
        },
        onMessage: async (messageId: string) => {
            let {currentChat, messages} = useChats.getState();
            if (!currentChat) return;

            const config = messages.find(m => m.id === messageId)!.config;
            console.log("Running model with config:", config);

            const omissions = await trpc.messages.listOmissions.query({ids: messages.map(m => m.id)});

            let isPostTarget = false;
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].author !== Author.USER) continue;

                const isTarget = messages[i].id === messageId;
                if (isTarget) isPostTarget = true;

                if (isPostTarget) {
                    let reply = await prepare(messages[i].id, config);

                    reply.state.any = true;
                    useChats.setState({messages: useChats.getState().messages});
                    console.log(
                        `Replying to message ${messages[i].id} using ${isTarget ? "config" : "its existing settings"}`,
                        reply.config
                    );

                    const memories = await useMemories.getState().remember(scrubText(extractText(messages[i].data)));
                    const context: MessageUnomitted[] = [
                        ({
                            author: Author.USER, data: [{
                                type: "text",
                                value: memories.length
                                    ? "Relevant long-term user context:\n"
                                    + memories.map(m => `* ${m}`).join("\n") + "\n\n"
                                    + "Use this only when relevant to the request."
                                    : ""
                            }]
                        } satisfies Partial<MessageUnomitted>) as MessageUnomitted,
                        ...messages.slice(0, i + 1).map(m => {
                            let isFirstText = true;
                            let fileNumber = 1;
                            return {
                                ...m,
                                metadata: omissions.get(m.id)?.metadata,
                                data: m.data.flatMap((d): zDataPartType[] => {
                                    if (d.type === "file") {
                                        return [
                                            {type: "text", value: `Attached file #${fileNumber++} (${d.name}):`},
                                            d
                                        ];
                                    }
                                    if (d.type === "text") {
                                        // TODO - embed model name in ::>:: tag and prepend "Earlier, [model] said:"
                                        let value = d.value.replace("::>::", ">");
                                        if (isFirstText) {
                                            if (m.author === Author.USER) value = `[user]\n${value}`;
                                            else value = `[assistant:model=${m.author.slice(m.author.indexOf("/") + 1)}]\n${value}`;
                                            isFirstText = false;
                                        }
                                        return [{...d, value}];
                                    }
                                    return [d];
                                })
                            }
                        })
                    ];

                    const userInstructions = useSettings.getState().getInstructions();
                    const instructions = `
This conversation may include responses from multiple AI models.

Previous user messages are labeled in the format:

[user]

Previous assistant messages are labeled in the format:

[assistant:model=<model-name>]

You are the AI model "${reply.config.model}." You should speak only as "${reply.config.model}."

IMPORTANT: These labels indicate which model generated each response and are NOT part of the message content.
Do NOT include your own label in your response – the system will add it automatically.`
                        + (userInstructions.length
                            ? `\n\n`
                            + `Additionally, the user provided the following instructions:\n`
                            + `${userInstructions.join("\n")}` : "");

                    const service = useServices.getState().findService(reply.config.service)!;
                    const preparedConfig = await get().prepareConfig(reply.config);

                    console.log("Using instructions:", instructions, "context:", context, "and args:", preparedConfig.args);

                    const abortController = new AbortController();
                    abortController.signal.addEventListener("abort", () => reply.data.push({type: "abort"}));
                    set({abortController});

                    const stream = service.generate(instructions, context, preparedConfig, abortController.signal);

                    let lastFlush = 0;
                    const flush = async () => {
                        useChats.setState({messages: [...useChats.getState().messages]});
                        reply = useChats.getState().messages.find(m => m.id === reply.id) as MessageUnomitted;
                        await new Promise<void>(r => setTimeout(r, 0));
                        lastFlush = performance.now();
                    };

                    let hasText = false;
                    for await (const part of stream) {
                        try {
                            const dataPart = zDataPart.parse(part);
                            if (dataPart.type === "abort") {
                                console.log("Received abort");
                                reply.data.push(dataPart);
                            } else if (dataPart.type === "thought") {
                                reply.state.thinking = true;
                                reply.data.push(dataPart);
                            } else if (dataPart.type === "text") {
                                reply.state.thinking = false;
                                reply.state.generating = true;
                                if (!hasText) {
                                    dataPart.value = dataPart.value.trimStart(); // fix preceding whitespace in some model output
                                    hasText = true;
                                }
                                const last = reply.data[reply.data.length - 1];
                                if (last?.type === "text") last.value += dataPart.value;
                                else reply.data.push(dataPart);
                            }
                        } catch (e) {
                            console.warn("Stream part isn't zDataPart, but this is probably normal");
                        }

                        try {
                            const streamEnd = StreamEnd.parse(part);
                            if (streamEnd.metadata) {
                                reply.metadata = streamEnd.metadata;
                            }
                        } catch {
                            // Not a metadata part – ignore
                        }

                        if (performance.now() - lastFlush >= 33) {
                            await flush();
                        }
                    }

                    set({abortController: null});

                    await flush();
                    await publish(reply);
                    console.log("Published reply:", reply);
                }
            }
        },
    })),
);

async function prepare(previousId: string, config: zConfigType): Promise<MessageUnomitted> {
    const messages = useChats.getState().messages;
    const existing = messages.find((m) => m.previousId === previousId);
    let reply = !existing
        ? await trpc.messages.create.mutate({
            chatId: messages[0].chatId,
            previousId: previousId,
            author: Author.MODEL,
            config: config,
            data: [],
            metadata: {}
        })
        : await trpc.messages.edit.mutate({
            id: existing.id,
            author: existing.author,
            config: existing.config,
            data: [],
            metadata: {},
            truncate: false,
        });
    await useChats.getState().fetchMessages(false);
    const replyRef = useChats.getState().messages.find((m) => m.id === reply.id) as MessageUnomitted;
    replyRef.metadata = {};
    return replyRef;
}

async function publish(prepared: MessageUnomitted) {
    await trpc.messages.edit.mutate({
        id: prepared.id,
        author: prepared.author,
        config: prepared.config,
        data: prepared.data,
        metadata: prepared.metadata,
        truncate: false,
    });
    await useChats.getState().fetchMessages(false);
}
