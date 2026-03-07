import {
    ActionIcon,
    Box,
    Button,
    CheckboxCard,
    CheckboxIndicator,
    Divider,
    Drawer,
    Group,
    Modal,
    Select,
    Space,
    Stack,
    Tabs,
    Text,
    Textarea,
    TextInput,
    Tooltip
} from "@mantine/core";
import {JSX, useEffect, useRef, useState} from "react";
import {IconBrandGithub, IconBrandGoogle, IconKey, IconPalette, IconSettingsAi, IconTrash} from "@tabler/icons-react";
import {useProviders} from "@/managers/providers.tsx";
import {codeThemes, themes, useSettings} from "@/managers/settings.tsx";
import {auth, consumeLabel, hashText, openExternal, trpc, webUrl} from "@/utils.ts";
import {useDisclosure, UseDisclosureReturnValue} from "@mantine/hooks";
import {useLayout} from "@/managers/layout.tsx";
import {zConfig} from "@tiny-chat/core-backend/types.ts";
import ModelSelect from "@/components/ModelSelect.tsx";
import {useTasks} from "@/managers/tasks.tsx";

export default function Drawers(
    {buttons}:
    {
        buttons: (account: UseDisclosureReturnValue, settings: UseDisclosureReturnValue)
            => JSX.Element
    }) {
    const [isCloning, setCloning] = useState(false);

    const {
        accounts,
        linkAccount,
        unlinkAccount,
        deleteUser,
        getInstructions,
        addInstruction,
        editInstruction,
        removeInstruction,
        getMemoryConfig,
        setMemoryConfig,
        getEmbeddingConfig,
        setEmbeddingConfig,
        getUseEmbeddingSearch,
        setUseEmbeddingSearch,
        getTheme,
        setTheme,
        getCodeTheme,
        setCodeTheme,
        getProviderSetting,
        setProviderSetting,
        getProviderError
    } = useSettings();
    const {chatProviders, searchProviders} = useProviders();
    const {setGestureBlock, setDrawerCloser} = useLayout();

    const {data: session} = auth.useSession();

    const codeThemeRef = useRef<HTMLInputElement>(null);

    const provider = (id: string, name: string, icon: JSX.Element) => (
        <Group justify="space-between">
            <Group gap={5}>
                {icon}
                <Text>{name}</Text>
            </Group>
            {accounts.find((account: any) => account.providerId === id) ? (
                accounts.length === 1 ? (
                    <Tooltip label="Must have one account" color="gray">
                        <Button variant="light" onClick={async () => await unlinkAccount(id)} disabled>Unlink</Button>
                    </Tooltip>
                ) : (
                    <Button variant="light" onClick={async () => await unlinkAccount(id)}>Unlink</Button>
                )
            ) : (
                <Button variant="default" onClick={async () => await linkAccount(id)}>Link</Button>
            )}
        </Group>
    );

    const accountDrawer = useDisclosure(false);
    const settingsDrawer = useDisclosure(false);

    const [addingInstruction, setAddingInstruction] = useState(false);
    const [embedChange, setEmbedChange] = useState<zConfig | null>(null);
    const [isEmbedConfirmOpen, {open: openEmbedConfirm, close: closeEmbedding}] = useDisclosure();
    const [isDeleteOpen, {open: openDelete, close: closeDelete}] = useDisclosure(false);

    // Modals fully block swipe gestures
    useEffect(() => {
        setGestureBlock(isDeleteOpen || isEmbedConfirmOpen);
    }, [isDeleteOpen, isEmbedConfirmOpen]);

    // Drawers intercept swipe-to-close so it closes the drawer before the sidebar
    useEffect(() => {
        if (accountDrawer[0]) {
            setDrawerCloser(accountDrawer[1].close);
        } else if (settingsDrawer[0]) {
            setDrawerCloser(settingsDrawer[1].close);
        } else {
            setDrawerCloser(null);
        }
        return () => setDrawerCloser(null);
    }, [accountDrawer[0], settingsDrawer[0]]);

    const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();

    const ProviderSettings = (providers: { name: string, settings: string[] }[]) => (
        <>
            {providers.filter(s => s.settings.length).map((service) => (
                <Box key={service.name}
                     style={getProviderError(service.name) ? {
                         border: "1px solid var(--mantine-color-red-6)",
                         borderRadius: "var(--mantine-radius-md)",
                         padding: "var(--mantine-spacing-xs)"
                     } : undefined}>
                    <Text size="sm">{service.name}</Text>
                    <Stack mt={5}>
                        {service.settings.map(s => (
                            <TextInput key={service.name + s}
                                       label={s}
                                       styles={consumeLabel}
                                       defaultValue={getProviderSetting(service.name, s) || ""}
                                       onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                       onBlur={async (e) => {
                                           if (e.target.value === (getProviderSetting(service.name, s) || "")) return;
                                           await setProviderSetting(service.name, s, e.target.value);
                                       }}/>
                        ))}
                    </Stack>
                </Box>
            ))}
        </>
    );

    return (
        <>
            {buttons(accountDrawer, settingsDrawer)}
            <Drawer opened={accountDrawer[0]} onClose={accountDrawer[1].close}
                    title={session?.user && !session.user.isAnonymous ? "Account" : "Sign In"}>
                <Stack>
                    {window.__TAURI__ ? (
                        <>
                            {isCloning ? <Text size="sm">Waiting for you to sign in...</Text> :
                                <Text c="dimmed" size="sm">Use the web to manage your account.</Text>}
                            <Button variant="default" fullWidth
                                    onClick={async () => {
                                        if (session?.user?.isAnonymous) {
                                            if (!isCloning) {
                                                setCloning(true);
                                                useTasks.getState().addTask("signIn", "Opening browser");
                                                const id = await trpc.sessions.startClone.mutate();
                                                await openExternal(`${webUrl}/#/app/${id}`);
                                                useTasks.getState().updateTask("signIn", 50, "Sign in to continue");
                                                setCloneInterval(setInterval(() => {
                                                    trpc.sessions.finalizeClone.query({id}).then(async (res) => {
                                                        if (res) {
                                                            await useTasks.getState().removeTask("signIn");
                                                            clearInterval(cloneInterval);
                                                            window.location.reload();
                                                        }
                                                    });
                                                }, 1000));
                                            } else {
                                                setCloning(false);
                                                clearInterval(cloneInterval);
                                            }
                                        } else {
                                            await openExternal(`${webUrl}`);
                                        }
                                    }}>
                                {isCloning ? "Cancel" : "Open Browser"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Text c="dimmed" size="sm">
                                Link an account to save chats and settings.
                            </Text>
                            {provider('google', 'Google', <IconBrandGoogle/>)}
                            {provider('github', 'GitHub', <IconBrandGithub/>)}
                        </>
                    )}
                    {(session?.user && !session.user.isAnonymous) && (
                        <>
                            <Divider/>
                            <Button variant="default" fullWidth mt={10} onClick={async () => {
                                useTasks.getState().addTask("signOut", "Signing out");
                                await auth.signOut();
                                await useTasks.getState().removeTask("signOut");
                                window.location.reload();
                            }}>
                                Sign Out
                            </Button>
                            <Button variant="outline" color="red" fullWidth mt={10} onClick={openDelete}>
                                Delete Account
                            </Button>
                            <Modal opened={isDeleteOpen} onClose={closeDelete} title="Delete Account">
                                <Button color="red" fullWidth onClick={async () => {
                                    await deleteUser();
                                    window.location.reload();
                                }}>
                                    Confirm
                                </Button>
                            </Modal>
                        </>
                    )}
                </Stack>
            </Drawer>
            <Drawer opened={settingsDrawer[0]} onClose={settingsDrawer[1].close} title="Settings">
                <Tabs defaultValue="general">
                    <Tabs.List mb="lg">
                        <Tabs.Tab value="general" leftSection={<IconSettingsAi size={16}/>}>General</Tabs.Tab>
                        <Tabs.Tab value="appearance" leftSection={<IconPalette size={16}/>}>Appearance</Tabs.Tab>
                        <Tabs.Tab value="apiKeys" leftSection={<IconKey size={16}/>}>API Keys</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="general">
                        <Stack>
                            <Text size="sm">Instructions</Text>
                            {getInstructions().map((instruction, index) => (
                                <Textarea
                                    key={hashText(index + instruction)}
                                    defaultValue={instruction}
                                    autosize
                                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                    onBlur={async (e) => {
                                        if (e.target.value === instruction) return;
                                        if (e.target.value) {
                                            await editInstruction(index, e.target.value);
                                        } else {
                                            await removeInstruction(index);
                                        }
                                    }}
                                    leftSection={<Text c="dimmed" size="xs">{index + 1}</Text>}
                                    rightSection={<ActionIcon variant="subtle" onClick={async () => {
                                        await removeInstruction(index);
                                    }}><IconTrash size={16}/></ActionIcon>}
                                />
                            ))}
                            <Tooltip label="System instructions for models" color="gray" position="right">
                                <Textarea key="add"
                                          autosize
                                          label="Instruction"
                                          styles={{...(consumeLabel), ...{input: {paddingTop: 25}}}}
                                          placeholder="Keep responses short."
                                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                          onBlur={async (e) => {
                                              if (!e.target.value) return;
                                              setAddingInstruction(true);
                                              await addInstruction(e.target.value);
                                              setAddingInstruction(false);
                                              e.target.value = "";
                                          }}
                                          disabled={addingInstruction}/>
                            </Tooltip>
                            <Space/>
                            <Text size="sm">Features</Text>
                            <Tooltip label="Model that generates embeddings" color="gray"
                                     position="right">
                                <ModelSelect label="Embedding Model"
                                             styles={consumeLabel}
                                             optional
                                             configValue={getEmbeddingConfig()}
                                             onConfigChange={(value) => {
                                                 setEmbedChange(value ?? null);
                                                 openEmbedConfirm();
                                             }}
                                             feature={"embed"}/>
                            </Tooltip>
                            <Modal title="Change Embedding Model" opened={isEmbedConfirmOpen}
                                   onClose={closeEmbedding}>
                                {embedChange
                                    ? <Text>All embeddings will be regenerated using the
                                        model <strong>{embedChange.model}</strong>.</Text>
                                    : <Text>Features like memory and smart search will not be available.</Text>}
                                <Button variant="gradient" fullWidth onClick={async () => {
                                    await setEmbeddingConfig(embedChange ?? undefined);
                                    closeEmbedding();
                                }} mt="lg">Confirm</Button>
                            </Modal>
                            <Tooltip
                                label={getEmbeddingConfig() ? "Model that decides new memories" : "Requires embedding model"}
                                color="gray" position="right">
                                <ModelSelect
                                    label="Memory Model"
                                    styles={consumeLabel}
                                    optional
                                    configValue={getMemoryConfig()}
                                    onConfigChange={async (value) => {
                                        await setMemoryConfig(value ?? undefined);
                                    }}
                                    feature={"generate"}
                                    disabled={!getEmbeddingConfig()}/>
                            </Tooltip>
                            <Tooltip
                                label={getEmbeddingConfig() ? "Considers semantic meaning of text" : "Requires embedding model"}
                                color="gray" position="right">
                                <CheckboxCard p="xs" checked={getUseEmbeddingSearch()} onChange={async (value) => {
                                    await setUseEmbeddingSearch(value);
                                }} disabled={!getEmbeddingConfig()}
                                              style={{cursor: !getEmbeddingConfig() ? "not-allowed" : "pointer"}}>
                                    <Group>
                                        <CheckboxIndicator size="xs" disabled={!getEmbeddingConfig()}/>
                                        <Text size="sm">Smart Search</Text>
                                    </Group>
                                </CheckboxCard>
                            </Tooltip>
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="appearance">
                        <Stack>
                            <Text size="sm">Themes</Text>
                            <Tooltip label="Styles the app" color="gray" position="right">
                                <Select label="App Theme"
                                        styles={consumeLabel}
                                        allowDeselect={false}
                                        data={themes}
                                        value={getTheme()}
                                        onChange={async (value) => {
                                            if (!value) return;
                                            await setTheme(value);
                                        }}>
                                </Select>
                            </Tooltip>
                            <Tooltip label="Styles code blocks" color="gray" position="right">
                                <Select label="Code Theme"
                                        styles={consumeLabel}
                                        allowDeselect={false}
                                        data={codeThemes(getTheme())}
                                        value={getCodeTheme()}
                                        onChange={async (value) => {
                                            if (!value) return;
                                            await setCodeTheme(value);
                                        }}
                                        ref={codeThemeRef}
                                />
                            </Tooltip>
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="apiKeys">
                        <Stack>
                            <Text size="sm">Chat</Text>
                            {ProviderSettings(chatProviders)}
                            <Space/>
                            <Text size="sm">Search</Text>
                            {ProviderSettings(searchProviders)}
                        </Stack>
                    </Tabs.Panel>
                </Tabs>
            </Drawer>
        </>
    )
}