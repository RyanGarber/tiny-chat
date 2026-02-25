import {
    ActionIcon,
    Button,
    Divider,
    Drawer,
    Group,
    Modal,
    Select,
    Stack,
    Tabs,
    Text,
    Textarea,
    TextInput,
    Tooltip
} from "@mantine/core";
import {nprogress} from "@mantine/nprogress";
import {JSX, useEffect, useRef, useState} from "react";
import {IconBrandGithub, IconBrandGoogle, IconKey, IconPalette, IconSettingsAi, IconTrash} from "@tabler/icons-react";
import {useServices} from "@/managers/services.tsx";
import {codeThemes, themes, useSettings} from "@/managers/settings.tsx";
import {alert, auth, consumeLabel, hashText, openExternal, trpc, webUrl} from "@/utils.ts";
import {useDisclosure, UseDisclosureReturnValue} from "@mantine/hooks";
import {useLayout} from "@/managers/layout.tsx";
import {zConfig} from "@tiny-chat/core-backend/types.ts";

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
        getTheme,
        setTheme,
        getCodeTheme,
        setCodeTheme,
        getApiKey,
        setApiKey
    } = useSettings();
    const {services} = useServices();
    const {setGestureBlock} = useLayout();

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
    const [isDeleteOpen, {open: openDelete, close: closeDelete}] = useDisclosure(false);
    useEffect(() => {
        setGestureBlock(accountDrawer[0] || settingsDrawer[0] || isDeleteOpen);
    }, [accountDrawer[0], settingsDrawer[0], isDeleteOpen]);

    const [cloneInterval, setCloneInterval] = useState<NodeJS.Timeout>();
    const [addingInstruction, setAddingInstruction] = useState(false);

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
                                                nprogress.start();
                                                const id = await trpc.sessions.startClone.mutate();
                                                await openExternal(`${webUrl}/#/app/${id}`);
                                                nprogress.complete();
                                                setCloneInterval(setInterval(() => {
                                                    trpc.sessions.finalizeClone.query({id}).then((res) => {
                                                        if (res) {
                                                            alert("info", "Signed in");
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
                                nprogress.start();
                                await auth.signOut();
                                nprogress.complete();
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
                            {/* delete on !value or keep button? */}
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
                                            alert("info", "Instruction saved");
                                        } else {
                                            await removeInstruction(index);
                                            alert("info", "Instruction removed");
                                        }
                                    }}
                                    leftSection={<Text c="dimmed" size="xs">{index + 1}</Text>}
                                    rightSection={<ActionIcon variant="subtle" onClick={async () => {
                                        await removeInstruction(index);
                                        alert("info", "Instruction removed");
                                    }}><IconTrash size={16}/></ActionIcon>}
                                />
                            ))}
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
                                          alert("info", "Instruction added");
                                      }}
                                      disabled={addingInstruction}/>
                            <Select label="Memory Model"
                                    styles={consumeLabel}
                                    data={services.map((s) => ({
                                        group: s.name,
                                        items: s.models.sort().map((m) => ({
                                            label: m,
                                            value: JSON.stringify({service: s.name, model: m}),
                                        })),
                                    }))}
                                    allowDeselect
                                    value={JSON.stringify({
                                        service: getMemoryConfig()?.service,
                                        model: getMemoryConfig()?.model
                                    })}
                                    onChange={async (value) => {
                                        console.log(JSON.stringify({
                                            service: getMemoryConfig()?.service,
                                            model: getMemoryConfig()?.model
                                        }))
                                        await setMemoryConfig(value ? zConfig.parse(JSON.parse(value)) : undefined);
                                        alert("info", "Memory model saved");
                                    }}/>
                            <Select label="Embedding Model"
                                    styles={consumeLabel}
                                    data={services.map((s) => ({
                                        group: s.name,
                                        items: s.models.sort().map((m) => ({
                                            label: m,
                                            value: JSON.stringify({service: s.name, model: m}),
                                        })),
                                    }))}
                                    allowDeselect
                                    value={JSON.stringify({
                                        service: getEmbeddingConfig()?.service,
                                        model: getEmbeddingConfig()?.model
                                    })}
                                    onChange={async (value) => {
                                        console.log(JSON.stringify({
                                            service: getEmbeddingConfig()?.service,
                                            model: getEmbeddingConfig()?.model
                                        }))
                                        await setEmbeddingConfig(value ? zConfig.parse(JSON.parse(value)) : undefined);
                                        alert("info", "Embedding model saved");
                                    }}/>
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="appearance">
                        <Stack>
                            <Select label="Theme"
                                    styles={consumeLabel}
                                    required
                                    allowDeselect={false}
                                    data={themes}
                                    value={getTheme()}
                                    onChange={async (value) => {
                                        if (!value) return;
                                        await setTheme(value);
                                        alert("info", "Theme saved");
                                    }}>
                            </Select>
                            <Select label="Code Theme"
                                    styles={consumeLabel}
                                    required
                                    allowDeselect={false}
                                    data={codeThemes(getTheme())}
                                    value={getCodeTheme()}
                                    onChange={async (value) => {
                                        if (!value) return;
                                        await setCodeTheme(value);
                                        alert("info", "Code theme saved");
                                    }}
                                    ref={codeThemeRef}
                            />
                        </Stack>
                    </Tabs.Panel>
                    <Tabs.Panel value="apiKeys">
                        <Stack>
                            {services.map((service) => (
                                <TextInput key={service.name}
                                           label={service.name}
                                           styles={consumeLabel}
                                           defaultValue={getApiKey(service.name) || ""}
                                           onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                           onBlur={async (e) => {
                                               if (e.target.value === (getApiKey(service.name) || "")) return;
                                               await setApiKey(service.name, e.target.value);
                                               alert("info", "API key saved");
                                           }}/>
                            ))}
                        </Stack>
                    </Tabs.Panel>
                </Tabs>
            </Drawer>
        </>
    )
}