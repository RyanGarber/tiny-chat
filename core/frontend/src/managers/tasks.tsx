import {create} from "zustand";

export interface Task {
    id: string;
    name: string;
    details?: string;
    progress: number;
    removeCallback?: () => void;
}

type UpdateBoxed = {
    version: string;
    currentVersion: string;
    date: string | undefined;
    started?: boolean;
};

interface Tasks {
    init: () => () => void;

    tasks: Record<string, Task>;
    addTask: (id: string, name: string, details?: string, progress?: number) => void;
    updateTask: (id: string, progress: number, details?: string, name?: string) => void;
    removeTask: (id: string) => Promise<void>;

    tauriUpdate: UpdateBoxed | null;
    findTauriUpdates: () => Promise<void>;
    startTauriUpdate: () => Promise<void>;
}

export const useTasks = create<Tasks>((set, get) => ({
    init: () => {
        void get().findTauriUpdates();
        const interval = setInterval(get().findTauriUpdates, 1000 * 60 * 60);
        return () => clearInterval(interval);
    },

    tasks: {},
    addTask: (id, name, details, progress = 0) => {
        set({tasks: {...get().tasks, [id]: {id, name, details, progress}}})
    },
    updateTask: (id, progress, details, name) => {
        if (!get().tasks[id]) return;
        set({
            tasks: {
                ...get().tasks,
                [id]: {
                    ...get().tasks[id],
                    ...(details !== undefined ? {details} : {}),
                    ...(name !== undefined ? {name} : {}),
                    progress,
                }
            }
        });
    },
    removeTask: async (id) => {
        if (!get().tasks[id]) return;
        let removed = false;
        get().tasks[id].removeCallback = () => removed = true;
        set({tasks: {...get().tasks}});
        while (!removed) {
            await new Promise(resolve => setTimeout(resolve));
        }
        const {[id]: _, ...rest} = get().tasks;
        set({tasks: rest});
    },

    tauriUpdate: null,
    findTauriUpdates: async () => {
        if (!("__TAURI__" in window)) return;

        const {type} = await import("@tauri-apps/plugin-os");
        if (!["linux", "macos", "windows"].includes(type())) return;

        const {check} = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) return;

        if (get().tauriUpdate?.version === update.version) return;

        set({tauriUpdate: update as UpdateBoxed | null});
    },
    startTauriUpdate: async () => {
        const {addTask, updateTask, removeTask} = get();

        const Update = (await import("@tauri-apps/plugin-updater")).Update.prototype;
        const update = get().tauriUpdate as typeof Update | null;
        set({tauriUpdate: {...get().tauriUpdate!, started: true}});

        let downloaded = false;
        let current = 0;
        let total: number | undefined;

        addTask("update", `Downloading ${update?.version ? `v${update.version}` : "update"}`, "App will update and restart");

        await update!.downloadAndInstall((event) => {
            if (event.event === "Started") {
                total = event.data.contentLength;
            }
            if (event.event === "Progress") {
                current += event.data.chunkLength;
                if (total) updateTask("update", current / total * 100);
            }
            if (event.event === "Finished") {
                (async () => {
                    await removeTask("update");
                    downloaded = true; // let animation play out
                })();
            }
        });

        while (!downloaded) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        await (await import("@tauri-apps/plugin-process")).relaunch();
    },
    updateProgress: null
}));
