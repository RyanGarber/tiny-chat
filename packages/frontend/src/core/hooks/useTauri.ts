import { useTauriStore } from '@/core/stores/useTauriStore';
import { isTauriDesktop as _isTauriDesktop } from '@/utils/api';
import { useMutation, useQuery } from '@tanstack/react-query';

interface UpdateBoxed {
  version: string;
  currentVersion: string;
  date: string | undefined;
}

export const useTauri = () => {
  const tauriUpdate = useQuery({
    queryKey: ['tauriUpdate'],
    queryFn: async () => {
      if (!(await _isTauriDesktop())) return null;

      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      return update as UpdateBoxed | null;
    },
  });

  const doTauriUpdate = useMutation({
    mutationFn: async (data: UpdateBoxed) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const Update = (await import('@tauri-apps/plugin-updater')).Update.prototype;
      const update = data as typeof Update | null;

      let current = 0;
      let total: number | undefined;

      // TODO - move
      void useTauriStore
        .getState()
        .addTask(
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
          if (total) void useTauriStore.getState().updateTask('update', (current / total) * 100);
        }
      });

      await useTauriStore.getState().removeTask('update');

      await (await import('@tauri-apps/plugin-process')).relaunch();
    },
  });

  const isTauriDesktop = useQuery({
    queryKey: ['isTauriDesktop'],
    queryFn: async () => {
      return await _isTauriDesktop();
    },
  });

  return { tauriUpdate, doTauriUpdate, isTauriDesktop };
};
