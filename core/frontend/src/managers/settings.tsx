import { z } from 'zod';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { auth, hljsThemeNames, trpc } from '@/utils.ts';
import { useProviders } from '@/managers/providers.tsx';
import { zConfig } from '@tiny-chat/core-backend/src/types.ts';
import { useTasks } from '@/managers/tasks.tsx';

export const zProviders = z.record(z.string(), z.any()).optional();
export const zSettings = z
  .object({
    instructions: z.array(z.string()),
    memoryConfig: zConfig,
    embeddingConfig: zConfig,
    useEmbeddingSearch: z.boolean(),
    theme: z.string(),
    codeTheme: z.string(),
    providers: zProviders,
  })
  .partial();
export type zSettingsType = z.infer<typeof zSettings>;

export const themes = ['dark', 'light'];
export const codeThemes = (theme: string) =>
  ({
    dark: hljsThemeNames.filter((t) => !t.includes('light')),
    light: hljsThemeNames.filter((t) => !t.includes('dark')),
  })[theme] ?? [];

interface Settings {
  init: () => Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accounts: any;
  linkAccount: (providerId: string) => Promise<void>;
  unlinkAccount: (providerId: string) => Promise<void>;
  deleteUser: () => Promise<void>;

  settings: zSettingsType;
  setSettings: (value: Partial<zSettingsType>, notify?: boolean) => Promise<void>;

  getInstructions: () => string[];
  addInstruction: (value: string) => Promise<void>;
  editInstruction: (index: number, value: string) => Promise<void>;
  removeInstruction: (index: number) => Promise<void>;

  getMemoryConfig: () => zConfig | undefined;
  setMemoryConfig: (value: zConfig | undefined) => Promise<void>;
  getEmbeddingConfig: () => zConfig | undefined;
  setEmbeddingConfig: (value: zConfig | undefined) => Promise<void>;
  getUseEmbeddingSearch: () => boolean;
  setUseEmbeddingSearch: (value: boolean) => Promise<void>;

  getTheme: () => string;
  setTheme: (value: string) => Promise<void>;
  getCodeTheme: () => string;
  setCodeTheme: (value: string) => Promise<void>;

  getProviderSetting: (service: string, key: string) => string | undefined;
  setProviderSetting: (service: string, key: string, value: string | undefined) => Promise<void>;

  providerErrors: Record<string, string | null>;
  getProviderError: (service: string) => string | null;
}

export const useSettings = create(
  subscribeWithSelector<Settings>((set, get) => ({
    init: async () => {
      const user = (await auth.getSession()).data?.user;
      const settings = zSettings.parse(user?.settings ?? {});
      set({
        accounts: (await auth.listAccounts()).data ?? [],
        settings,
      });
    },

    accounts: [],
    linkAccount: async (providerId) => {
      useTasks.getState().addTask('linkAccount', 'Linking account');
      await auth.signIn.social({ provider: providerId, callbackURL: window.location.href });
      await useTasks.getState().removeTask('linkAccount');
    },
    unlinkAccount: async (providerId) => {
      useTasks.getState().addTask('unlinkAccount', 'Unlinking account');
      await auth.unlinkAccount({ providerId });
      await useTasks.getState().updateTask('unlinkAccount', 50);
      set({ accounts: (await auth.listAccounts()).data ?? [] });
      await useTasks.getState().removeTask('unlinkAccount');
    },
    deleteUser: async () => {
      useTasks.getState().addTask('deleteUser', 'Deleting account');
      await auth.deleteUser();
      await useTasks.getState().removeTask('deleteUser');
    },

    settings: {},
    setSettings: async (value, notify = true) => {
      const getSettings = async () =>
        zSettings.parse((await auth.getSession()).data?.user?.settings ?? {});
      if (notify) useTasks.getState().addTask('setSettings', 'Saving settings');
      await auth.updateUser({ settings: { ...(await getSettings()), ...value } });
      if (notify) await useTasks.getState().updateTask('setSettings', 50);
      set({ settings: await getSettings() });
      if (notify) await useTasks.getState().removeTask('setSettings');
    },

    getInstructions: () => {
      return get().settings.instructions ?? [];
    },
    addInstruction: async (value) => {
      await get().setSettings({ instructions: [...get().getInstructions(), value] });
    },
    editInstruction: async (index, value) => {
      await get().setSettings({
        instructions: get()
          .getInstructions()
          .map((v, i) => (i === index ? value : v)),
      });
    },
    removeInstruction: async (index) => {
      console.log(`Removing instruction ${index}`);
      await get().setSettings({
        instructions: get()
          .getInstructions()
          .filter((_, i) => {
            console.log(`Instruction #${i}: '${_}': removing: ${i !== index}`);
            return i !== index;
          }),
      });
    },

    getMemoryConfig: () => {
      return zConfig.safeParse(get().settings.memoryConfig).data;
    },
    setMemoryConfig: async (value) => {
      await get().setSettings({ memoryConfig: value });
    },
    getEmbeddingConfig: () => {
      return zConfig.safeParse(get().settings.embeddingConfig).data;
    },
    setEmbeddingConfig: async (value) => {
      await get().setSettings({ embeddingConfig: value });
      console.log('Resetting all embeddings due to changed model');
      await trpc.embeddings.reset.mutate();
      await useTasks.getState().fixMissingEmbeddings();
    },
    getUseEmbeddingSearch: () => {
      return get().settings.useEmbeddingSearch ?? true;
    },
    setUseEmbeddingSearch: async (value) => {
      await get().setSettings({ useEmbeddingSearch: value });
    },

    getTheme: () => {
      const selected = get().settings.theme;
      if (selected && themes.includes(selected)) return selected;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    setTheme: async (value) => {
      await get().setSettings({ theme: value });
    },
    getCodeTheme: () => {
      const available = codeThemes(get().getTheme());
      const selected = get().settings.codeTheme;
      return selected && available.includes(selected) ? selected : available[0];
    },
    setCodeTheme: async (value) => {
      await get().setSettings({ codeTheme: value });
    },

    getProviderSetting: (name, key) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access
      return get().settings.providers?.[name]?.[key];
    },
    setProviderSetting: async (name, key, value) => {
      useTasks.getState().addTask('setProviderSetting', 'Saving provider settings');
      const providers = get().settings.providers ?? {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      if (value) providers[name] = { ...providers[name], [key]: value };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      else delete providers[name]?.[key];
      await get().setSettings({ providers }, false);
      if (useProviders.getState().chatProviders.find((p) => p.name === name)) {
        void useTasks.getState().updateTask('setProviderSetting', 50);
        try {
          const models = await trpc.providers.getChatModels.query({ service: name });
          const count = models.length;
          void useTasks
            .getState()
            .updateTask('setProviderSetting', 75, `${count} model${count === 1 ? '' : 's'} added`);
          set({ providerErrors: { ...get().providerErrors, [name]: null } });
        } catch (e: unknown) {
          set({
            providerErrors: {
              ...get().providerErrors,
              [name]: (e as Error).message ?? 'Provider error',
            },
          });
        }
        await useProviders.getState().updateProviders();
      }
      await useTasks.getState().removeTask('setProviderSetting');
    },

    providerErrors: {},
    getProviderError: (service) => {
      return get().providerErrors[service] ?? null;
    },
  })),
);
