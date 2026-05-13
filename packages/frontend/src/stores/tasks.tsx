import { create } from 'zustand';

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

interface Tasks {
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
}

export const useTasks = create<Tasks>((set, get) => ({
  tasks: {},
  addTask: (id, name, details, progress = 0, options = {}) => {
    if (get().tasks[id]) return;
    set({
      tasks: {
        ...get().tasks,
        [id]: {
          id,
          name,
          details,
          progress,
          options: { crawlSpeed: 5, crawlMax: 50, ...options },
        },
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
}));
