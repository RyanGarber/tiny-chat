import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";

type BoxedUpdate = {
    version: string;
    currentVersion: string;
    date: string | undefined;
};

interface Updates {
    init: () => () => void;
    pendingUpdate: BoxedUpdate | null;
    checkForUpdates: () => Promise<void>;
    doUpdate: () => Promise<void>;
    updateProgress: number | null;
}

export const useUpdates = create(subscribeWithSelector<Updates>((set, get) => {
    return {
        init: () => {
            void get().checkForUpdates();
            const interval = setInterval(get().checkForUpdates, 1000 * 60 * 60);
            return () => clearInterval(interval);
        },
        pendingUpdate: null,
        checkForUpdates: async () => {
            if (!("__TAURI__" in window)) return;

            const {type} = await import("@tauri-apps/plugin-os");
            if (!["linux", "macos", "windows"].includes(type())) return;

            const {check} = await import("@tauri-apps/plugin-updater");
            const update = await check();
            if (!update) return;

            const {pendingUpdate} = get();
            if (pendingUpdate?.version === update.version) return;

            set({pendingUpdate: update as BoxedUpdate | null});
        },
        doUpdate: async () => {
            const {Update} = await import("@tauri-apps/plugin-updater");
            const update = get().pendingUpdate as (typeof Update.prototype) | null;

            let downloaded = 0;
            let total: number | undefined;
            set({updateProgress: 0});

            await update!.downloadAndInstall((event) => {
                if (event.event === "Started") {
                    total = event.data.contentLength;
                }
                if (event.event === "Progress") {
                    downloaded += event.data.chunkLength;
                    if (total) set({updateProgress: downloaded / total});
                }
                if (event.event === "Finished") {
                    set({updateProgress: null});
                }
            });

            await (await import("@tauri-apps/plugin-process")).relaunch();
        },
        updateProgress: null
    }
}));