import {
  Button,
  CloseButton,
  Dialog,
  Group,
  RingProgress,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Task, useTasks } from '@/stores/tasks.tsx';
import { useDisclosure } from '@mantine/hooks';
import { format } from 'timeago.js';
import { useLayout } from '@/stores/layout.tsx';

interface DisplayedTask extends Task {
  /** Whether this task is in its removal animation / hold phase */
  removing: boolean;
  displayedProgress: number;
}

export default function Tasks() {
  const tasks = useTasks((s) => s.tasks);
  const color = useMantineTheme().primaryColor;
  const shadow = useLayout((s) => s.shadow);

  const [displayedTasks, setDisplayedTasks] = useState<Record<string, DisplayedTask>>({});

  // Ref mirrors so callbacks never see stale closures
  const displayedRef = useRef<Record<string, DisplayedTask>>({});
  const tasksRef = useRef<Record<string, Task>>({});
  const animFramesRef = useRef<Record<string, number>>({});
  const holdTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const jitterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  tasksRef.current = tasks;

  const setDisplayed = useCallback(
    (updater: (prev: Record<string, DisplayedTask>) => Record<string, DisplayedTask>) => {
      displayedRef.current = updater(displayedRef.current);
      setDisplayedTasks({ ...displayedRef.current });
    },
    [],
  );

  useEffect(() => {
    for (const [id, task] of Object.entries(tasks)) {
      const displayed = displayedRef.current[id];

      // ── New task ──────────────────────────────────────────────────────
      if (!displayed) {
        setDisplayed((prev) => ({
          ...prev,
          [id]: { ...task, removing: false, displayedProgress: task.progress },
        }));
        continue;
      }

      // ── Metadata-only update (no animTarget change) ───────────────────
      if (task.animTarget === undefined && !task.removeResolve) {
        setDisplayed((prev) =>
          prev[id]
            ? { ...prev, [id]: { ...prev[id], name: task.name, message: task.details } }
            : prev,
        );
        continue;
      }

      // ── Animate toward animTarget ─────────────────────────────────────
      if (task.animTarget !== undefined) {
        const target = task.animTarget;
        const isRemoval = task.removeResolve !== undefined;

        // Don't restart animation if already running toward the same target — but still sync metadata
        if (displayed.animTarget === target && animFramesRef.current[id]) {
          setDisplayed((prev) =>
            prev[id]
              ? { ...prev, [id]: { ...prev[id], name: task.name, message: task.details } }
              : prev,
          );
          continue;
        }

        // Cancel any previous animation for this task
        if (animFramesRef.current[id]) cancelAnimationFrame(animFramesRef.current[id]);
        if (holdTimersRef.current[id]) clearTimeout(holdTimersRef.current[id]);

        const startProgress = displayedRef.current[id]?.displayedProgress ?? 0;
        const startTime = performance.now();
        // Removal always gets 500 ms; progress updates scale with distance (min 200 ms, max 600 ms)
        const distance = Math.abs(target - startProgress);
        const duration = isRemoval ? 500 : Math.min(600, Math.max(200, distance * 6));

        // Mirror animTarget (and updated metadata) into displayedRef so the continue-guard above works
        setDisplayed((prev) =>
          prev[id]
            ? {
                ...prev,
                [id]: {
                  ...prev[id],
                  name: task.name,
                  message: task.details,
                  animTarget: target,
                  removing: isRemoval,
                },
              }
            : prev,
        );

        const animate = (now: number) => {
          const t = Math.min((now - startTime) / duration, 1);
          // Ease-out cubic
          const ease = 1 - Math.pow(1 - t, 3);
          const newProgress = startProgress + (target - startProgress) * ease;

          setDisplayed((prev) =>
            prev[id] ? { ...prev, [id]: { ...prev[id], displayedProgress: newProgress } } : prev,
          );

          if (t < 1) {
            animFramesRef.current[id] = requestAnimationFrame(animate);
          } else {
            delete animFramesRef.current[id];
            // Resolve the update promise (animResolve)
            task.animResolve?.();

            if (isRemoval) {
              // Hold at 100 % briefly, then dismiss
              holdTimersRef.current[id] = setTimeout(() => {
                setDisplayed(({ [id]: _, ...rest }) => rest);
                task.removeResolve?.();
                delete holdTimersRef.current[id];
              }, 600);
            }
          }
        };

        animFramesRef.current[id] = requestAnimationFrame(animate);
      }
    }

    // Clean up displayed tasks that are no longer in the store (edge-case safety)
    for (const id of Object.keys(displayedRef.current)) {
      if (!tasks[id] && !holdTimersRef.current[id] && !animFramesRef.current[id]) {
        setDisplayed(({ [id]: _, ...rest }) => rest);
      }
    }
  }, [tasks, setDisplayed]);

  // Jitter loop — organically bumps non-animating, non-removing tasks
  useEffect(() => {
    const tick = () => {
      setDisplayed((prev) => {
        const realTasks = tasksRef.current;
        let changed = false;
        const updated: Record<string, DisplayedTask> = {};

        for (const [id, task] of Object.entries(prev)) {
          // Skip tasks that are animating toward a target or being removed
          if (task.removing || animFramesRef.current[id]) {
            updated[id] = task;
            continue;
          }
          const realProgress = realTasks[id]?.progress ?? task.displayedProgress;
          const cap = Math.min(realProgress + task.options.crawlMax, 99);
          if (task.displayedProgress >= cap) {
            updated[id] = task;
            continue;
          }
          const multiplier = Math.max(
            0,
            Math.min(1, (cap - task.displayedProgress) / task.options.crawlMax),
          );
          const bump = Math.random() * task.options.crawlSpeed * multiplier;
          updated[id] = { ...task, displayedProgress: task.displayedProgress + bump };
          changed = true;
        }

        return changed ? updated : prev;
      });

      jitterTimerRef.current = setTimeout(tick, 500 + Math.random() * 1500);
    };

    jitterTimerRef.current = setTimeout(tick, 500 + Math.random() * 1500);

    return () => {
      if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
    };
  }, [setDisplayed]);

  // Cleanup on unmount
  useEffect(() => {
    const animFrames = animFramesRef.current;
    const holdTimers = holdTimersRef.current;
    return () => {
      Object.values(animFrames).forEach(cancelAnimationFrame);
      Object.values(holdTimers).forEach(clearTimeout);
      if (jitterTimerRef.current) clearTimeout(jitterTimerRef.current);
    };
  }, []);

  const taskList = Object.values(displayedTasks);

  const [isUpdateShown, { open: showUpdate, close: hideUpdate }] = useDisclosure();
  const tauriUpdate = useTasks((s) => s.tauriUpdate);
  const startTauriUpdate = useTasks((s) => s.startTauriUpdate);

  useEffect(() => {
    if (tauriUpdate) {
      if (!tauriUpdate.started) showUpdate();
      else hideUpdate();
    }
  }, [hideUpdate, showUpdate, tauriUpdate]);

  const updateTimeAgo: string | null = tauriUpdate?.date
    ? format(new Date(tauriUpdate.date))
    : null;

  return (
    <Dialog
      opened={taskList.length > 0 || isUpdateShown}
      withCloseButton={false}
      className="dialog"
      style={{ boxShadow: shadow }}
      zIndex={10000}
    >
      <Stack gap="xs">
        {taskList.map((task) => (
          <Group key={task.id}>
            <RingProgress
              sections={[{ value: task.displayedProgress, color }]}
              size={30}
              thickness={3}
            />
            <Stack gap={0}>
              <Text size="sm">{task.name}</Text>
              <Text size="xs" c="dimmed">
                {task.details ?? ''}
              </Text>
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
              <CloseButton onClick={hideUpdate} mt={-5} mr={-5} />
              <Button variant="filled" size="xs" onClick={() => void startTauriUpdate()}>
                Update
              </Button>
            </Stack>
          </Group>
        )}
      </Stack>
    </Dialog>
  );
}
