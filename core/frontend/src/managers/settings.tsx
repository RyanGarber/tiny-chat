import {z} from "zod";
import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {auth, hljsThemeNames} from "@/utils.ts";
import {useServices} from "@/managers/services.tsx";
import {nprogress} from "@mantine/nprogress";

export const zServices = z.record(z.string(), z.object({apiKey: z.string()})).optional();
export const zSettings = z.object({
    instructions: z.array(z.string()).optional(),
    theme: z.string().optional(),
    codeTheme: z.string().optional(),
    services: zServices.optional(),
});
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

    getTheme: () => string;
    setTheme: (value: string) => Promise<void>;
    getCodeTheme: () => string;
    setCodeTheme: (value: string) => Promise<void>;

    getApiKey: (service: string) => string | null;
    setApiKey: (service: string, value: string) => Promise<void>;
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
        return get().settings.services?.[service]?.apiKey ?? null;
    },
    setApiKey: async (service, value) => {
        nprogress.start();
        await get().setSettings({services: {...get().settings.services, [service]: {apiKey: value}}}, false);
        nprogress.set(50);
        await useServices.getState().fetchServices();
        nprogress.complete();
    }
})));
