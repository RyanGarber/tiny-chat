import {useChats} from "@/managers/chats.tsx";
import {reloadConfig} from "@/managers/messaging.tsx";
import {create} from "zustand";
import {format} from "timeago.js";
import {subscribeWithSelector} from "zustand/middleware";
import {MessageUnomitted, Service, zConfig, zDataPart, zMetadata} from "@tiny-chat/core-backend/types.ts";
import {generate, trpc} from "@/utils.ts";
import {useSettings} from "@/managers/settings.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {useMemories} from "@/managers/context.tsx";
import {useTasks} from "@/managers/tasks.tsx";

interface Services {
    init: () => Promise<void>;

    services: Service[];
    fetchServices: () => Promise<void>;

    abortController: AbortController | null;
    onMessage: (messageId: string) => Promise<void>;
}

export const useServices = create(
    subscribeWithSelector<Services>((set, get) => ({
        init: async () => {
            await get().fetchServices();
        },

        services: [],
        fetchServices: async () => {
            useTasks.getState().addTask("models", "Finding models");

            let available = await trpc.services.listServices.query();

            const availableModels = available.reduce((acc, s) => acc + s.models.length, 0);
            useTasks.getState().updateTask("models", 100, `Found ${availableModels} model${availableModels === 1 ? "" : "s"}`, "Finding models");

            console.log("Fetched services:", available);
            set({services: available});
            reloadConfig();

            void useTasks.getState().removeTask("models");
        },

        abortController: null,
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

                    const memories = currentChat.incognito ? [] : await useMemories.getState().getRelevantMemories(messages[i]);
                    const context: MessageUnomitted[] = [
                        ({
                            author: Author.USER, data: [{
                                type: "text",
                                value: memories.length ?
                                    `Potentially relevant long-term user context:

${memories.map(m => `* ${m}`).join("\n")}

IMPORTANT: Do not introduce or revisit the above topics unless:
* The user explicitly asks, or
* a brief, optional follow-up question would feel natural to a human in that moment.` : ""
                            }]
                        } satisfies Partial<MessageUnomitted>) as MessageUnomitted,
                        ...messages.slice(0, i + 1).map((m, i) => {
                            let isFirstText = true;
                            let fileNumber = 1;
                            return {
                                ...m,
                                metadata: omissions.get(m.id)?.metadata,
                                data: m.data.flatMap((d): zDataPart[] => {
                                    if (d.type === "file") {
                                        return [
                                            {type: "text", value: `Attached file #${fileNumber++} (${d.name}):`},
                                            d
                                        ];
                                    }
                                    if (d.type === "text") {
                                        let value = d.value.replace(/((?:^::>:: .*$\n?)+)/gm, (block) => {
                                            const lines = block.trim().split("\n").map(l => l.replace(/^::>:: /, ""));
                                            let modelName = "";
                                            let contentLines = lines;
                                            if (lines[0].startsWith("::model=") && lines[0].endsWith("::")) {
                                                modelName = lines[0].slice("::model=".length, -2);
                                                contentLines = lines.slice(1);
                                            }
                                            const prefix = modelName ? `Earlier, ${modelName} said:\n` : "";
                                            return prefix + contentLines.map(l => `> ${l}`).join("\n") + "\n";
                                        });
                                        if (isFirstText) {
                                            let heading;
                                            if (m.author === Author.USER) {
                                                heading = `[user]\n`;
                                                if (i !== 0) {
                                                    const delay = format(messages[i - 1].createdAt, undefined, {relativeDate: m.createdAt}).replace(" ago", "");
                                                    if (delay !== "just now") heading += `[Conversation timing: ${delay} ${delay.endsWith("s") ? "have" : "has"} passed since the last message.]\n`;
                                                }
                                            } else {
                                                heading = `[assistant:model=${m.config.model}]\n`;
                                            }
                                            value = heading + "\n" + value;
                                            isFirstText = false;
                                        }
                                        return [{...d, value}];
                                    }
                                    return [d];
                                })
                            }
                        })
                    ];

                    const userInstructions = currentChat.incognito ? [] : useSettings.getState().getInstructions();
                    const instructions = `
Today's date is ${new Date().toLocaleDateString()}.
Assume knowledge must reflect current information. Prefer search results over training knowledge.
For news, software, and other time-sensitive topics, always search. If uncertainty exists, search.

This conversation may include responses from multiple AI models. Previous assistant messages are labeled in the format:

[assistant:model=<model-name>]

You are the AI model "${reply.config.model}." You should speak only as "${reply.config.model}.
You should call out and refer to other models by name when appropriate."`
                        + (userInstructions.length
                            ? `\n\n`
                            + `Additionally, the user provided the following instructions:\n`
                            + `${userInstructions.join("\n")}` : "");

                    console.log("Using instructions:", instructions, "context:", context, "and args:", config.args);

                    const abortController = new AbortController();
                    abortController.signal.addEventListener("abort", () => reply.data.push({type: "abort"}));
                    set({abortController});

                    const stream = generate(
                        {
                            instruction: instructions,
                            context: context.map(m => ({author: m.author, data: m.data})),
                            config
                        },
                        abortController.signal
                    );

                    let lastFlush = 0;
                    const flush = async () => {
                        useChats.setState({messages: [...useChats.getState().messages]});
                        reply = useChats.getState().messages.find(m => m.id === reply.id) as MessageUnomitted;
                        await new Promise<void>(r => setTimeout(r, 0));
                        lastFlush = performance.now();
                    };

                    try {
                        let hasText = false;
                        for await (const event of stream) {
                            console.log("Received event:", event);

                            if (event.type === "data") {
                                if (event.value.type === "text") {
                                    reply.state.thinking = false;
                                    reply.state.generating = true;
                                    if (!hasText) {
                                        event.value.value = event.value.value.trimStart();
                                        hasText = true;
                                    }
                                    const last = reply.data[reply.data.length - 1];
                                    if (last?.type === "text") last.value += event.value.value;
                                    else reply.data.push(event.value);
                                } else {
                                    reply.data.push(event.value);
                                    if (event.value.type === "thought") {
                                        reply.state.thinking = true;
                                    }
                                }
                            } else if (event.type === "special") {
                                if (event.value.type === "metadata") {
                                    (reply.metadata as zMetadata[]).push(event.value.value);
                                } else if (event.value.type === "fileUpdate") {
                                    const fileName = event.value.name;
                                    const file = reply.data.filter(p => p.type === "file").find(p => p.name === fileName);
                                    if (file) {
                                        console.log("Updating URL of file:", file.name, "from URL:", file.url, "to:", event.value.url);
                                        file.url = event.value.url;
                                        console.log("Updated file (local):", file.url, "(global):", reply.data.filter(p => p.type === "file").find(p => p.name === fileName)?.url);
                                    }
                                }
                            }

                            if (performance.now() - lastFlush >= 33) {
                                await flush();
                            }
                        }
                    } catch (e: any) {
                        if (e.name === "AbortError") console.warn("Stream aborted");
                        else throw e;
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

async function prepare(previousId: string, config: zConfig): Promise<MessageUnomitted> {
    const messages = useChats.getState().messages;
    const existing = messages.find((m) => m.previousId === previousId);
    let reply = !existing
        ? await trpc.messages.create.mutate({
            chatId: messages[0].chatId,
            previousId: previousId,
            author: Author.MODEL,
            config: config,
            data: [],
            metadata: []
        })
        : await trpc.messages.edit.mutate({
            id: existing.id,
            author: existing.author,
            config: existing.config,
            data: [],
            metadata: [],
            truncate: false,
        });
    await useChats.getState().fetchMessages(false);
    const replyRef = useChats.getState().messages.find((m) => m.id === reply.id) as MessageUnomitted;
    replyRef.metadata = [];
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
