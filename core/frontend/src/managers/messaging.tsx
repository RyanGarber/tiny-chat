import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {useChats} from "@/managers/chats.tsx";
import {BaseEditor, Editor, Transforms} from "slate";
import {ReactEditor} from "slate-react";
import {HistoryEditor} from "slate-history";
import {deserialize} from "@/slate/serializer.tsx";
import {alert, extractText, scrubText, trpc} from "@/utils.ts";
import {useServices} from "@/managers/services.tsx";
import {nprogress} from "@mantine/nprogress";
import {useLayout} from "@/managers/layout.tsx";
import {type MessageOmitted, zConfig, zConfigType, type zDataType} from "@tiny-chat/core-backend/types";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {readLocalStorageValue} from "@mantine/hooks";

type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

interface Messaging {
    editor: CustomEditor | null;
    setEditor: (editor: CustomEditor) => void;
    clearEditor: () => void;
    cursorPosition: number | null;

    files: File[];
    addFiles: (...files: File[]) => void;
    removeFile: (file: File) => void;
    addQuote: (content: string) => void;

    editing: MessageOmitted | null;
    setEditing: (editing: MessageOmitted | null) => void;

    truncating: boolean;
    setTruncating: (truncating: boolean) => void;

    insertingAfter: MessageOmitted | null;
    setInsertingAfter: (insertingAfter: MessageOmitted | null) => void;

    temporary: boolean;
    setTemporary: (temporary: boolean) => void;

    reset: () => void;

    config: zConfigType | null;
    setConfig: (value: zConfigType) => void;

    scrollRequested: number;
    requestScrollToBottom: () => void;

    sendMessage: (data: zDataType) => Promise<void>;
    deleteMessagePair: (messageId: string) => Promise<void>;
}

export const useMessaging = create(
    subscribeWithSelector<Messaging>((set, get) => ({
        editor: null,
        setEditor: (editor) => {
            set({editor});
        },

        cursorPosition: null,

        clearEditor: () => {
            const {editor} = get();
            if (!editor) return;
            Transforms.select(editor, {
                anchor: Editor.start(editor, []),
                focus: Editor.end(editor, []),
            });
            Transforms.delete(editor);
            Transforms.setNodes(editor, {type: "paragraph"});
        },

        files: [],
        addFiles: (...files) => {
            set({files: [...get().files, ...files]});
        },
        removeFile: (file) => {
            set({files: get().files.filter(f => f !== file)});
        },
        addQuote: (content) => {
            const {editor, cursorPosition} = get();
            if (!editor) return;

            const quote = {type: "quote", children: [{text: content}]};
            const insertAt = cursorPosition ?? 0;
            editor.insertNode(quote, {at: [insertAt]});
        },

        editing: null,
        setEditing: async (value) => {
            const {setConfig, setInsertingAfter, editor, clearEditor} = get();
            if (!editor) return;

            if (value) {
                setInsertingAfter(null);
                await setInputData(value.data);
            } else {
                clearEditor();
            }

            set({editing: value, truncating: value !== null});
            if (value) setConfig(value.config);
            else reloadConfig();
        },

        truncating: false,
        setTruncating: (truncating) => {
            set({truncating});
        },

        insertingAfter: null,
        setInsertingAfter: (value) => {
            const {editing, setEditing} = get();
            if (value && editing) setEditing(null);
            set({files: [], insertingAfter: value});
        },

        temporary: false,
        setTemporary: async (temporary) => {
            console.log(`Setting temporary to ${temporary}`);
            await useChats.getState().setCurrentChat(null, false, false);
            set({temporary});
        },

        reset: () => {
            console.trace("Resetting messaging state");
            const {setEditing, setInsertingAfter} = get();
            set({files: [], temporary: false});
            setEditing(null);
            setInsertingAfter(null);
        },

        scrollRequested: 0,
        requestScrollToBottom: () => set({scrollRequested: get().scrollRequested + 1}),

        config: null,
        setConfig: (value) => {
            set({config: value});
        },

        sendMessage: async (data) => {
            const {config, truncating, temporary, reset, editing} = get();
            const {setCurrentChat, fetchFolders, fetchMessages} = useChats.getState();
            let currentChat = useChats.getState().currentChat;
            if (!config) return;

            setInputDisabled(true);
            nprogress.start();
            reset();

            let message: MessageOmitted;
            if (editing) {
                console.log(
                    `Editing message ${editing.id} (truncate: ${truncating}):`,
                    data,
                );
                message = await trpc.messages.edit.mutate({
                    id: editing.id,
                    author: editing.author,
                    config,
                    data,
                    metadata: {},
                    truncate: truncating,
                });
            } else {
                console.log(`Sending message in ${currentChat?.id ?? "new chat"}:`, data, "temporary:", temporary);
                message = await trpc.messages.create.mutate({
                    chatId: currentChat?.id,
                    author: Author.USER,
                    config,
                    data,
                    metadata: {},
                    previousId: get().insertingAfter?.id,
                    temporary
                });
            }
            nprogress.set(33);
            await fetchFolders(false);
            nprogress.set(66);
            if (!currentChat) await setCurrentChat(message.chatId, true, false);
            else await fetchMessages(false);
            nprogress.complete();

            reloadConfig();
            currentChat = useChats.getState().currentChat!;

            if (!currentChat.title) {
                console.log("Chat has no title; setting one");
                await trpc.chats.edit.mutate({id: currentChat.id, title: scrubText(extractText(data), 100)});
                await fetchFolders(false);
            }

            try {
                console.log(`Running model ${get().config!.model} on message ${message.id}`);
                await useServices.getState().onMessage(message.id);
            } catch (e) {
                alert("error", "Failed to run model")
                await get().deleteMessagePair(message.id);
                await setInputData(data);
                throw e;
            } finally {
                setInputDisabled(false);
            }
        },

        deleteMessagePair: async (messageId) => {
            setInputDisabled(true);
            nprogress.start();
            await trpc.messages.delete.mutate({id: messageId});
            nprogress.set(33);
            await useChats.getState().fetchFolders(false);
            nprogress.set(66);
            await useChats.getState().fetchMessages(false);
            nprogress.complete();
            setInputDisabled(false);
        },
    })),
);

async function setInputData(data: zDataType) {
    const {editor, clearEditor, addFiles} = useMessaging.getState();
    if (!editor) return;

    clearEditor();
    Transforms.insertNodes(editor, deserialize(extractText(data)));
    Transforms.removeNodes(editor, {at: [0]});

    const files: File[] = [];
    for (const file of data.filter(p => p.type === "file")) {
        files.push(new File([await (await fetch(file.url)).blob()], file.name, {type: file.mime}));
    }
    addFiles(...files);
}

function setInputDisabled(disabled: boolean) {
    const {isMessagingDisabled, setMessagingDisabled} = useLayout.getState();
    if (isMessagingDisabled === disabled) return;
    setMessagingDisabled(disabled);
}

export function reloadConfig() {
    const {setConfig} = useMessaging.getState();
    let {messages} = useChats.getState();
    let sorted = [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (sorted.length) {
        console.log("Found messages in chat; loading last message's config:", sorted[0].config);
        setConfig(sorted[0].config);
        return;
    }
    console.log("No messages in chat; trying fallback configs");
    let lastConfigString = readLocalStorageValue<string>({key: "config", sync: true});
    const lastConfig = lastConfigString ? zConfig.parse(JSON.parse(lastConfigString)) : null;
    const fallbackService = useServices.getState().services.find(s => s.models.length > 0);
    try {
        setConfig(lastConfig ?? {
            service: fallbackService!.name,
            model: fallbackService!.models[0]
        });
        console.log("Loaded config:", lastConfig, "(last config:", lastConfig, ", fallback service:", fallbackService, ")");
    } catch {
        console.warn("Failed to load config or fall back to default service");
    }
}