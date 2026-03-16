import { create } from 'zustand';
import { useSettings } from '@/stores/settings.tsx';
import { trpc } from '@/utils/api';

export interface TaskOptions {
  crawlSpeed: number;
  crawlMax: number;
}

export interface Task {
  id: string;
  name: string;
  details?: string;
  progress: number;
  options: TaskOptions;
  /** When set, the component should animate displayedProgress toward this value, then call animResolve. */
  animTarget?: number;
  animResolve?: () => void;
  /** When set, after animTarget animation completes, the component should dismiss and call removeResolve. */
  removeResolve?: () => void;
}

interface UpdateBoxed {
  version: string;
  currentVersion: string;
  date: string | undefined;
  started?: boolean;
}

interface Tasks {
  init: () => () => void;

  tasks: Record<string, Task>;
  addTask: (
    id: string,
    name: string,
    details?: string,
    progress?: number,
    options?: Partial<TaskOptions>,
  ) => void;
  updateTask: (id: string, progress?: number, details?: string, name?: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  fixMissingEmbeddings: () => Promise<void>;

  tauriUpdate: UpdateBoxed | null;
  findTauriUpdates: () => Promise<void>;
  startTauriUpdate: () => Promise<void>;
}

export const useTasks = create<Tasks>((set, get) => ({
  init: () => {
    void get().findTauriUpdates();
    void get().fixMissingEmbeddings();
    const interval = setInterval(
      () => {
        void get().findTauriUpdates();
        void get().fixMissingEmbeddings();
      },
      1000 * 60 * 10,
    );
    return () => clearInterval(interval);
  },

  tasks: {},
  addTask: (id, name, details, progress = 0, options = {}) => {
    if (get().tasks[id]) return;
    set({
      tasks: {
        ...get().tasks,
        [id]: { id, name, details, progress, options: { crawlSpeed: 5, crawlMax: 50, ...options } },
      },
    });
  },
  updateTask: (id, progress, details, name) => {
    if (!get().tasks[id]) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const current = get().tasks[id];
      // If no real progress change, just update metadata and resolve immediately
      if (progress === undefined || progress === current.progress) {
        set({
          tasks: {
            ...get().tasks,
            [id]: {
              ...current,
              ...(details !== undefined ? { details } : {}),
              ...(name !== undefined ? { name } : {}),
            },
          },
        });
        resolve();
        return;
      }
      set({
        tasks: {
          ...get().tasks,
          [id]: {
            ...current,
            ...(details !== undefined ? { details } : {}),
            ...(name !== undefined ? { name } : {}),
            progress,
            animTarget: progress,
            animResolve: resolve,
          },
        },
      });
    });
  },
  removeTask: async (id) => {
    if (!get().tasks[id]) return;
    await new Promise<void>((resolve) => {
      set({
        tasks: {
          ...get().tasks,
          [id]: {
            ...get().tasks[id],
            animTarget: 100,
            removeResolve: resolve,
          },
        },
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [id]: _, ...rest } = get().tasks;
    set({ tasks: rest });
  },

  fixMissingEmbeddings: async () => {
    if (!useSettings.getState().settings.embeddingConfig) return;

    const { addTask, updateTask, removeTask } = get();

    const result = await trpc.embeddings.fixMissing.mutate();
    if (result.messages.total === 0 && result.memories.total === 0) return;

    addTask('fix-embeddings', 'Generating embeddings');
    const failed =
      result.messages.total + result.memories.total - result.messages.fixed - result.memories.fixed;
    if (failed > 0) {
      void updateTask('fix-embeddings', 100, `${failed} could not be generated`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      void updateTask(
        'fix-embeddings',
        100,
        `${result.messages.fixed + result.memories.fixed} embeddings generated`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await removeTask('fix-embeddings');
  },

  tauriUpdate: null,
  findTauriUpdates: async () => {
    if (!('__TAURI__' in window)) return;

    const { type } = await import('@tauri-apps/plugin-os');
    if (!['linux', 'macos', 'windows'].includes(type())) return;

    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return;

    if (get().tauriUpdate?.version === update.version) return;

    set({ tauriUpdate: update as UpdateBoxed | null });
  },
  startTauriUpdate: async () => {
    const { addTask, updateTask, removeTask } = get();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const Update = (await import('@tauri-apps/plugin-updater')).Update.prototype;
    const update = get().tauriUpdate as typeof Update | null;
    set({ tauriUpdate: { ...get().tauriUpdate!, started: true } });

    let current = 0;
    let total: number | undefined;

    addTask(
      'update',
      `Downloading ${update?.version ? `v${update.version}` : 'update'}`,
      'App will update and restart',
    );

    await update!.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength;
      }
      if (event.event === 'Progress') {
        current += event.data.chunkLength;
        if (total) void updateTask('update', (current / total) * 100);
      }
    });

    await removeTask('update');

    await (await import('@tauri-apps/plugin-process')).relaunch();
  },
}));
