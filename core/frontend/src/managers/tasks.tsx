import {create} from "zustand";

export interface Task {
    id: string;
    name: string;
    details?: string;
    progress: number;
}

interface Tasks {
    tasks: Record<string, Task>;
    setTask: (id: string, name: string, details?: string, progress?: number) => void;
    updateTask: (id: string, progress: number, details?: string, name?: string) => void;
    removeTask: (id: string) => void;
}

export const useTasks = create<Tasks>((set) => ({
    tasks: {},

    setTask: (id, name, details, progress = 0) =>
        set((state) => ({
            tasks: {...state.tasks, [id]: {id, name, details, progress}}
        })),

    updateTask: (id, progress, details, name) =>
        set((state) => {
            const existing = state.tasks[id];
            if (!existing) return state;
            return {
                tasks: {
                    ...state.tasks,
                    [id]: {
                        ...existing,
                        progress, ...(details !== undefined ? {details} : {}), ...(name !== undefined ? {name} : {})
                    }
                }
            };
        }),

    removeTask: (id) =>
        set((state) => {
            const {[id]: _, ...rest} = state.tasks;
            return {tasks: rest};
        }),
}));
