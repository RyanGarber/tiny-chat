import {useChats} from "@/managers/chats.tsx";
import {reloadConfig} from "@/managers/messaging.tsx";
import {services, StreamEnd} from "@/services";
import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {MessageUnomitted, zConfigType, zDataPart, zDataPartType} from "@tiny-chat/core-backend/types.ts";
import {alert, trpc} from "@/utils.ts";
import {useSettings} from "@/managers/settings.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

interface Services {
    init: () => Promise<void>;

    services: {
        name: string;
        models: string[];
    }[];
    findService: (query: string) => ReturnType<typeof services.find>;

    fetchServices: () => Promise<void>;

    onMessage: (messageId: string) => Promise<void>;
}

export const useServices = create(
    subscribeWithSelector<Services>((set, get) => ({
        init: async () => {
            await get().fetchServices();
        },

        services: [],
        findService: (query) => services.find((s) => s.name === query.split("/")[0]),

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
                    const replyValue = await prepare(messages[i].id, config);
                    messages = useChats.getState().messages;
                    let lastRender = Date.now();
                    const update = (set: ((reply: MessageUnomitted) => void)) => {
                        const replyRef = messages.find(m => m.id === replyValue.id)!;
                        set(replyValue); // TODO - not happy with this setup
                        replyRef.state = replyValue.state;
                        replyRef.data = replyValue.data;
                        if (Date.now() - lastRender > 100) {
                            useChats.setState({messages: [...messages]});
                            lastRender = Date.now();
                        }
                    }

                    update(reply => reply.state.working = true);
                    console.log(
                        `Replying to message ${messages[i].id} using ${isTarget ? "config" : "its existing settings"}`,
                        replyValue.config
                    );

                    const context: MessageUnomitted[] = messages.slice(0, i + 1).map(m => {
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
                    });

                    // TODO - prefix/explanation before user instructions?
                    const userInstructions = useSettings.getState().getInstructions();
                    const instructions = `You are the AI model "${replyValue.config.model}."\n\n`
                        + `This conversation may include responses from multiple AI models.\n\n`
                        + `Previous user messages are labeled in the format:\n\n`
                        + `[user]\n\n`
                        + `Previous assistant messages are labeled in the format:\n\n`
                        + `[assistant:model=<model-name>]\n\n`
                        + `These labels indicate which model generated each response and are NOT part of the message content.\n`
                        + `You are "${replyValue.config.model}." You should speak only as "${replyValue.config.model}."\n\n`
                        + `IMPORTANT: Do NOT include your own label in your response – the system will add it automatically.`
                        + (userInstructions.length
                            ? `\n\n`
                            + `Additionally, the user provided the following instructions:\n`
                            + `${userInstructions.join("\n")}` : "");

                    const service = useServices.getState().findService(replyValue.config.service)!;
                    const preparedConfig = replyValue.config;
                    for (const arg of service.getArgs(config.model)!) {
                        if (preparedConfig.args?.[arg.name] === undefined) {
                            console.log(`Using default value for arg ${arg.name}:`, arg.default)
                            if (preparedConfig.args === undefined) preparedConfig.args = {};
                            preparedConfig.args[arg.name] = arg.default;
                        }
                    }

                    console.log("Using instructions:", instructions, "context:", context, "and args:", preparedConfig.args);

                    const stream = service.callModel(instructions, context, preparedConfig);
                    const data: zDataPartType[] = [];
                    const state = replyValue.state;

                    for await (const part of stream) {
                        try {
                            const dataPart = zDataPart.parse(part);
                            if (dataPart.type === "thought") {
                                state.thinking = true;
                                data.push(dataPart);
                            } else if (dataPart.type === "text") {
                                state.thinking = false;
                                state.generating = true;
                                if (!data.filter(d => d.type === "text").length)
                                    dataPart.value = dataPart.value.trimStart(); // fix preceding whitespace in some model output
                                const last = data[data.length - 1];
                                if (last?.type === "text") last.value += dataPart.value;
                                else data.push(dataPart);
                            }
                            update(r => {
                                r.state = state;
                                r.data = data;
                            });
                        } catch (e) {
                            console.warn("Stream part isn't zDataPart, but this is probably normal");
                        }

                        try {
                            const streamEnd = StreamEnd.parse(part);
                            if (streamEnd.metadata) {
                                console.log("Saving metadata:", streamEnd)
                                update(r => r.metadata = streamEnd.metadata);
                            }
                        } catch {
                            // Ignore non-metadata parts failing
                        }
                    }

                    replyValue.state.working = false;
                    replyValue.state.thinking = false;
                    replyValue.state.generating = false;

                    await publish(replyValue);
                    console.log("Published reply:", replyValue);
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
    return {...useChats.getState().messages.find((m) => m.id === reply.id)!, metadata: {}};
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
