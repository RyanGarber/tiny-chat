import {z} from "zod";
import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {auth, hljsThemeNames, trpc} from "@/utils.ts";
import {useServices} from "@/managers/services.tsx";
import {nprogress} from "@mantine/nprogress";
import {zConfig, zConfigType} from "@tiny-chat/core-backend/types.ts";

export const zServices = z.record(z.string(), z.object({apiKey: z.string()})).optional();
export const zSettings = z.object({
    instructions: z.array(z.string()),
    memoryConfig: zConfig,
    embeddingConfig: zConfig,
    useEmbeddingSearch: z.boolean(),
    theme: z.string(),
    codeTheme: z.string(),
    services: zServices,
}).partial();
export type zSettingsType = z.infer<typeof zSettings>;

export const themes = ["dark", "light"];
export const codeThemes = (theme: string) => ({
    dark: hljsThemeNames.filter(t => !t.includes('light')),
    light: hljsThemeNames.filter(t => !t.includes('dark'))
})[theme] ?? [];

interface Settings {
    init: () => Promise<void>;

    accounts: any,
    linkAccount: (providerId: string) => Promise<void>;
    unlinkAccount: (providerId: string) => Promise<void>;
    deleteUser: () => Promise<void>;

    settings: zSettingsType;
    setSettings: (value: Partial<zSettingsType>, notify?: boolean) => Promise<void>;

    getInstructions: () => string[];
    addInstruction: (value: string) => Promise<void>;
    editInstruction: (index: number, value: string) => Promise<void>;
    removeInstruction: (index: number) => Promise<void>;

    getMemoryConfig: () => zConfigType | undefined;
    setMemoryConfig: (value: zConfigType | undefined) => Promise<void>;
    getEmbeddingConfig: () => zConfigType | undefined;
    setEmbeddingConfig: (value: zConfigType | undefined) => Promise<void>;
    getUseEmbeddingSearch: () => boolean;
    setUseEmbeddingSearch: (value: boolean) => Promise<void>;

    getTheme: () => string;
    setTheme: (value: string) => Promise<void>;
    getCodeTheme: () => string;
    setCodeTheme: (value: string) => Promise<void>;

    getApiKey: (service: string) => string | undefined;
    setApiKey: (service: string, value: string | undefined) => Promise<void>;
}

export const useSettings = create(subscribeWithSelector<Settings>((set, get) => ({
    init: async () => {
        const user = (await auth.getSession()).data?.user;
        const settings = zSettings.parse(user?.settings ?? {});
        set({
            accounts: (await auth.listAccounts()).data ?? [],
            settings
        });
    },

    accounts: [],
    linkAccount: async (providerId) => {
        nprogress.start();
        await auth.signIn.social({provider: providerId, callbackURL: window.location.href});
        nprogress.complete();
    },
    unlinkAccount: async (providerId) => {
        nprogress.start();
        await auth.unlinkAccount({providerId});
        nprogress.set(50);
        set({accounts: (await auth.listAccounts()).data ?? []});
        nprogress.complete();
    },
    deleteUser: async () => {
        nprogress.start();
        await auth.deleteUser();
        nprogress.complete();
    },

    settings: {},
    setSettings: async (value, notify = true) => {
        const getSettings = async () => zSettings.parse((await auth.getSession()).data?.user?.settings ?? {});
        if (notify) nprogress.start();
        await auth.updateUser({settings: {...await getSettings(), ...value}});
        if (notify) nprogress.set(50);
        set({settings: await getSettings()});
        if (notify) nprogress.complete();
    },

    getInstructions: () => {
        return get().settings.instructions ?? [];
    },
    addInstruction: async (value) => {
        await get().setSettings({instructions: [...get().getInstructions(), value]});
    },
    editInstruction: async (index, value) => {
        await get().setSettings({instructions: get().getInstructions().map((v, i) => i === index ? value : v)});
    },
    removeInstruction: async (index) => {
        console.log(`Removing instruction ${index}`)
        await get().setSettings({
            instructions: get().getInstructions().filter((_, i) => {
                console.log(`Instruction #${i}: '${_}': removing: ${i !== index}`);
                return i !== index
            })
        });
    },

    getMemoryConfig: () => {
        return zConfig.safeParse(get().settings.memoryConfig).data;
    },
    setMemoryConfig: async (value) => {
        await get().setSettings({memoryConfig: value});
    },
    getEmbeddingConfig: () => {
        return zConfig.safeParse(get().settings.embeddingConfig).data;
    },
    setEmbeddingConfig: async (value) => {
        await get().setSettings({embeddingConfig: value});
        console.log("Resetting all embeddings due to changed model");
        void trpc.embeddings.resetAll.mutate();
    },
    getUseEmbeddingSearch: () => {
        return get().settings.useEmbeddingSearch ?? true;
    },
    setUseEmbeddingSearch: async (value) => {
        await get().setSettings({useEmbeddingSearch: value});
    },


    getTheme: () => {
        const selected = get().settings.theme;
        if (selected && themes.includes(selected)) return selected;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
    setTheme: async (value) => {
        await get().setSettings({theme: value});
    },
    getCodeTheme: () => {
        const available = codeThemes(get().getTheme());
        const selected = get().settings.codeTheme;
        return selected && available.includes(selected) ? selected : available[0];
    },
    setCodeTheme: async (value) => {
        await get().setSettings({codeTheme: value});
    },

    getApiKey: (service) => {
        return get().settings.services?.[service]?.apiKey;
    },
    setApiKey: async (service, value) => {
        nprogress.start();
        const services = get().settings.services ?? {};
        if (value) services[service] = {apiKey: value};
        else delete services[service];
        await get().setSettings({services}, false);
        nprogress.set(50);
        await useServices.getState().fetchServices();
        nprogress.complete();
    }
})));
