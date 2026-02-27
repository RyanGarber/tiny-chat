import {Dialog, Group, RingProgress, Stack, Text, useMantineTheme} from "@mantine/core";
import {useCallback, useEffect, useRef, useState} from "react";
import {Task, useTasks} from "@/managers/tasks.tsx";

interface DisplayedTask extends Task {
    completing: boolean;
    displayedProgress: number;
}

/** Max percentage points the jitter is allowed to run ahead of the real progress */
const JITTER_HEADROOM = 7;

export default function Tasks() {
    const tasks = useTasks((s) => s.tasks);
    const color = useMantineTheme().primaryColor;

    const [displayedTasks, setDisplayedTasks] = useState<Record<string, DisplayedTask>>({});

    // Ref mirrors so animation/jitter callbacks never see stale closures
    const displayedRef = useRef<Record<string, DisplayedTask>>({});
    const tasksRef = useRef<Record<string, Task>>({});
    const prevTasksRef = useRef<Record<string, Task>>({});
    const completingRef = useRef<Set<string>>(new Set());
    const animFramesRef = useRef<Record<string, number>>({});
    const closeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const jitterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep tasksRef in sync so jitter closure always reads fresh real progress
    tasksRef.current = tasks;

    /** Syncs both the ref and React state in one call */
    const setDisplayed = useCallback(
        (updater: (prev: Record<string, DisplayedTask>) => Record<string, DisplayedTask>) => {
            displayedRef.current = updater(displayedRef.current);
            setDisplayedTasks({...displayedRef.current});
        },
        []
    );

    useEffect(() => {
        const prevTasks = prevTasksRef.current;
        prevTasksRef.current = tasks;

        // Add / update active tasks — preserve displayedProgress if jitter pushed it ahead
        for (const [id, task] of Object.entries(tasks)) {
            if (!completingRef.current.has(id)) {
                setDisplayed((prev) => ({
                    ...prev,
                    [id]: {
                        ...task,
                        completing: false,
                        // Don't go backwards; snap forward if real progress overtakes jitter
                        displayedProgress: Math.max(task.progress, prev[id]?.displayedProgress ?? 0),
                    },
                }));
            }
        }

        // Detect tasks that were just removed → start completion animation
        for (const id of Object.keys(prevTasks)) {
            if (tasks[id] || completingRef.current.has(id)) continue;

            completingRef.current.add(id);
            if (animFramesRef.current[id]) cancelAnimationFrame(animFramesRef.current[id]);
            if (closeTimersRef.current[id]) clearTimeout(closeTimersRef.current[id]);

            const startProgress = displayedRef.current[id]?.displayedProgress ?? 100;
            const startTime = performance.now();
            const duration = 500;

            const animate = (now: number) => {
                const t = Math.min((now - startTime) / duration, 1);
                const newProgress = startProgress + (100 - startProgress) * t;

                setDisplayed((prev) =>
                    prev[id]
                        ? {...prev, [id]: {...prev[id], displayedProgress: newProgress, completing: true}}
                        : prev
                );

                if (t < 1) {
                    animFramesRef.current[id] = requestAnimationFrame(animate);
                } else {
                    closeTimersRef.current[id] = setTimeout(() => {
                        setDisplayed(({[id]: _, ...rest}) => rest);
                        completingRef.current.delete(id);
                    }, 700);
                }
            };

            animFramesRef.current[id] = requestAnimationFrame(animate);
        }
    }, [tasks, setDisplayed]);

    // Jitter loop — bumps active tasks by a small random amount on a random interval
    useEffect(() => {
        const tick = () => {
            setDisplayed((prev) => {
                const realTasks = tasksRef.current;
                let changed = false;
                const updated: Record<string, DisplayedTask> = {};

                for (const [id, task] of Object.entries(prev)) {
                    if (task.completing) {
                        updated[id] = task;
                        continue;
                    }
                    const realProgress = realTasks[id]?.progress ?? task.displayedProgress;
                    const cap = Math.min(realProgress + JITTER_HEADROOM, 99);
                    if (task.displayedProgress >= cap) {
                        updated[id] = task;
                        continue;
                    }
                    // Random bump: 0.3–2.2 percentage points
                    const bump = 0.3 + Math.random() * 1.9;
                    updated[id] = {...task, displayedProgress: Math.min(task.displayedProgress + bump, cap)};
                    changed = true;
                }

                return changed ? updated : prev;
            });

            // Schedule next tick at a random interval so it feels organic (600–2200 ms)
            jitterTimerRef.current = setTimeout(tick, 600 + Math.random() * 1600);
        };

        jitterTimerRef.current = setTimeout(tick, 600 + Math.random() * 1600);

        return () => {
            if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
        };
    }, [setDisplayed]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(animFramesRef.current).forEach(cancelAnimationFrame);
            Object.values(closeTimersRef.current).forEach(clearTimeout);
            if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
        };
    }, []);

    const taskList = Object.values(displayedTasks);

    return (
        <Dialog opened={taskList.length > 0} withCloseButton={false} className="dialog">
            <Stack gap="xs">
                {taskList.map((task) => (
                    <Group key={task.id}>
                        <RingProgress
                            sections={[{value: task.displayedProgress, color}]}
                            size={30}
                            thickness={3}
                        />
                        <Stack gap={0}>
                            <Text size="sm">{task.name}</Text>
                            <Text size="xs" c="dimmed">{task.details ?? ''}</Text>
                        </Stack>
                    </Group>
                ))}
            </Stack>
        </Dialog>
    );
}