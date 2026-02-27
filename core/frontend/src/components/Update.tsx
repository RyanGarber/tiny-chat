import {useDisclosure} from "@mantine/hooks";
import {useUpdates} from "@/managers/updates.tsx";
import {Button, Dialog, Group, RingProgress, Stack, Text, useMantineTheme} from "@mantine/core";
import {useEffect} from "react";
import {format} from "timeago.js";

export default function Update() {
    const [isUpdateShown, {open: showUpdate, close: hideUpdate}] = useDisclosure();
    const {pendingUpdate, doUpdate, updateProgress} = useUpdates();

    const color = useMantineTheme().primaryColor;

    useEffect(() => {
        if (!pendingUpdate) return;
        showUpdate();
    }, [pendingUpdate]);

    let releasedAgo: string | null = pendingUpdate?.date ? format(new Date(pendingUpdate.date)) : null;

    return (
        <Dialog opened={isUpdateShown} onClose={hideUpdate} withCloseButton={!updateProgress}
                className="dialog">
            {!updateProgress ? (
                <Group justify="space-between" align="center">
                    <Stack gap={0}>
                        <Text>Update available</Text>
                        <Text size="sm" c="dimmed">
                            v{pendingUpdate?.version} released {releasedAgo}
                        </Text>
                    </Stack>
                    <Button variant="filled" size="xs" onClick={doUpdate} mt={25}>Update</Button>
                </Group>
            ) : (
                <Group>
                    <RingProgress sections={[{value: updateProgress ?? 0, color: color}]} size={30} thickness={3}/>
                    <Stack gap={0}>
                        <Text size="sm">Downloading v{pendingUpdate?.version}</Text>
                        <Text size="xs" c="dimmed">App will update and restart</Text>
                    </Stack>
                </Group>
            )}
        </Dialog>
    );
}