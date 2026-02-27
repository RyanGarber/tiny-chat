import {create} from "zustand";
import {reloadConfig, useMessaging} from "@/managers/messaging.tsx";
import {subscribeWithSelector} from "zustand/middleware";
import {trpc} from "@/utils.ts";
import {Chat} from "@tiny-chat/core-backend/generated/prisma/client";
import {MessageOmitted} from "@tiny-chat/core-backend/types.ts";
import {FolderListData} from "@tiny-chat/core-backend/routes/folders.ts";
import {navigate} from "wouter/use-hash-location";
import {nprogress} from "@mantine/nprogress";

interface Chats {
    init: () => Promise<void>;

    folders: FolderListData[];
    fetchFolders: (showProgress?: boolean) => Promise<void>;
    messages: MessageOmitted[];
    fetchMessages: (showProgress?: boolean) => Promise<void>;

    currentChat: Chat | null;
    setCurrentChat: (
        id: string | null,
        pushState?: boolean,
        showProgress?: boolean,
    ) => Promise<void>;
    renameChat: (id: string, title: string) => Promise<void>;
    cloneChat: (messageId: string) => Promise<void>;
    deleteChat: (id: string) => Promise<void>;
}

export const useChats = create(
    subscribeWithSelector<Chats>((set, get) => ({
        init: async () => {
            await get().fetchFolders();
        },

        folders: [],
        fetchFolders: async (showProgress = true) => {
            if (showProgress) nprogress.start();
            const chats = await trpc.folders.list.query();
            const {currentChat} = get();
            set({currentChat: currentChat ? await trpc.chats.find.query({id: currentChat.id}) : null});
            set({folders: chats});
            if (showProgress) nprogress.complete();
        },
        messages: [],
        fetchMessages: async (showProgress = true) => {
            const {currentChat} = get();
            if (showProgress) nprogress.start();
            const messages = currentChat
                ? await trpc.messages.list.query({chatId: currentChat.id})
                : [];
            set({messages});
            console.log("Messages:", messages);
            if (showProgress) nprogress.complete();
        },

        currentChat: null,
        setCurrentChat: async (id, pushState = true, showProgress = true) => {
            if (showProgress) nprogress.start();
            let chat = await trpc.chats.find.query({id: id!});
            if (id && !chat) {
                if (pushState) nprogress.complete();
                return;
            }
            if (pushState) navigate(id ? `/${id}` : "/");
            useMessaging.getState().reset();
            set({currentChat: chat});
            if (showProgress) nprogress.set(50);
            await get().fetchMessages(false);
            useMessaging.getState().requestScrollToBottom();
            if (showProgress) nprogress.complete();
            if (pushState) reloadConfig();
        },
        renameChat: async (id, name) => {
            const {fetchFolders} = get();
            nprogress.start();
            await trpc.chats.edit.mutate({id: id, title: name});
            nprogress.set(50);
            await fetchFolders(false);
            nprogress.complete();
        },
        cloneChat: async (untilMessageId) => {
            const {currentChat, setCurrentChat, fetchFolders} = get();
            console.log("Cloning chat at message:", untilMessageId);
            nprogress.start();
            const chat = await trpc.chats.clone.mutate({
                id: currentChat!.id,
                untilMessageId,
                title: `Fork of ${currentChat!.title}`
            });
            nprogress.set(33);
            await fetchFolders(false);
            nprogress.set(66);
            await setCurrentChat(chat.id, true, false);
            nprogress.complete();
        },
        deleteChat: async (id) => {
            const {currentChat, setCurrentChat, fetchFolders} = get();
            console.log(`Deleting chat ${id}`);
            if (id === currentChat?.id) nprogress.start();
            await trpc.chats.delete.mutate({id: id});
            nprogress.set(33);
            await fetchFolders(false);
            nprogress.set(66);
            if (currentChat?.id === id) await setCurrentChat(null, true, false);
            nprogress.complete();
        },
    })),
);