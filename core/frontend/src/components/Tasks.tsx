import {Button, CloseButton, Dialog, Group, RingProgress, Stack, Text, useMantineTheme} from "@mantine/core";
import {useCallback, useEffect, useRef, useState} from "react";
import {Task, useTasks} from "@/managers/tasks.tsx";
import {useDisclosure} from "@mantine/hooks";
import {format} from "timeago.js";
import {useLayout} from "@/managers/layout.tsx";

interface DisplayedTask extends Task {
    completing: boolean;
    displayedProgress: number;
}

export default function Tasks() {
    const {tasks} = useTasks();
    const color = useMantineTheme().primaryColor;
    const {shadow} = useLayout();

    const [displayedTasks, setDisplayedTasks] = useState<Record<string, DisplayedTask>>({});

    // Ref mirrors so animation/jitter callbacks never see stale closures
    const displayedRef = useRef<Record<string, DisplayedTask>>({});
    const tasksRef = useRef<Record<string, Task>>({});
    const removingRef = useRef<Set<string>>(new Set());
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
        // Add / update active tasks — preserve displayedProgress if jitter pushed it ahead
        for (const [id, task] of Object.entries(tasks)) {
            if (!task.removeCallback) {
                setDisplayed((prev) => ({
                    ...prev,
                    [id]: {
                        ...task,
                        completing: false,
                        // Don't go backwards; snap forward if real progress overtakes jitter
                        displayedProgress: Math.max(task.progress, prev[id]?.displayedProgress ?? 0),
                    },
                }));
            } else if (!removingRef.current.has(id)) {
                removingRef.current.add(id);
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
                            task.removeCallback?.();
                            removingRef.current.delete(id);
                        }, 700);
                    }
                };

                animFramesRef.current[id] = requestAnimationFrame(animate);
            }
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
                    const maxAhead = 25;
                    const realProgress = realTasks[id]?.progress ?? task.displayedProgress;
                    const cap = Math.min(realProgress + maxAhead, 99);
                    if (task.displayedProgress >= cap) {
                        updated[id] = task;
                        continue;
                    }
                    const multiplier = Math.max(0, Math.min(1, ((realProgress + maxAhead) - task.displayedProgress) / maxAhead));
                    const bump = (1 + Math.random() * 4) * multiplier;
                    updated[id] = {...task, displayedProgress: task.displayedProgress + bump};
                    changed = true;
                }

                return changed ? updated : prev;
            });

            // Schedule next tick at a random interval so it feels organic (500–2000 ms)
            jitterTimerRef.current = setTimeout(tick, 500 + Math.random() * 1500);
        };

        jitterTimerRef.current = setTimeout(tick, 500 + Math.random() * 1500);

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

    const [isUpdateShown, {open: showUpdate, close: hideUpdate}] = useDisclosure();
    const {tauriUpdate, startTauriUpdate} = useTasks();

    useEffect(() => {
        if (tauriUpdate) {
            if (!tauriUpdate.started) showUpdate();
            else hideUpdate();
        }
    }, [tauriUpdate]);

    let updateTimeAgo: string | null = tauriUpdate?.date ? format(new Date(tauriUpdate.date)) : null;

    return (
        <Dialog opened={taskList.length > 0 || isUpdateShown} withCloseButton={false} className="dialog"
                style={{boxShadow: shadow}}>
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
                {isUpdateShown && (
                    <Group key="update" justify="space-between" align="center">
                        <Stack gap={0}>
                            <Text>Update available</Text>
                            <Text size="sm" c="dimmed">
                                v{tauriUpdate?.version} released {updateTimeAgo}
                            </Text>
                        </Stack>
                        <Stack gap={5} justify="space-between" align="end">
                            <CloseButton onClick={hideUpdate} mt={-5} mr={-5}/>
                            <Button variant="filled" size="xs" onClick={startTauriUpdate}>Update</Button>
                        </Stack>
                    </Group>
                )}
            </Stack>
        </Dialog>
    );
}