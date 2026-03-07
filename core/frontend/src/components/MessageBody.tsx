import {Box, Group, Skeleton, Stack, Text,} from "@mantine/core";
import {useElementSize} from "@mantine/hooks";
import {MessageOmitted} from "@tiny-chat/core-backend/types";
import MessageBodyContent from "@/components/MessageBodyContent.tsx";
import {useLayout} from "@/managers/layout.tsx";
import {IconArrowForwardUp, IconPaperclip,} from "@tabler/icons-react";
import {useChats} from "@/managers/chats.tsx";
import Attachments from "@/components/Attachments.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

export default function MessageBody({message}: { message: MessageOmitted }) {
    const {shadow} = useLayout();
    const {messages} = useChats();

    const {ref: containerRef, width: containerWidth} = useElementSize();

    if (message.author === Author.USER) {
        const config = messages[messages.findIndex(m => m.id === message.id) + 1]?.config;
        const files = message.data.filter(p => p.type === "file");
        return (
            <Box ref={containerRef}>
                <Stack gap={5} maw="100%">
                    {config && <Group gap={5} c="dimmed">
                        <IconArrowForwardUp size={14}/>
                        <Text size="xs">{config.model}</Text>
                    </Group>}

                    <Box
                        px={20}
                        py={10}
                        bdrs="lg"
                        className="user-message"
                        style={{boxShadow: shadow}}
                    >
                        <MessageBodyContent message={message} containerWidth={containerWidth}/>
                    </Box>
                    {files.length !== 0 &&
                        <Group gap={0} c="dimmed">
                            <IconPaperclip size={14}/>
                            <Attachments list={files.map(f => ({name: f.name, mime: f.mime, url: f.url}))}/>
                        </Group>
                    }
                </Stack>
            </Box>
        );
    } // no thinking or generating for user messages

    const hasRenderedParts = message.data.length > 0;
    const showContent = !message.state.any || message.state.generating || hasRenderedParts;

    return (
        <Box
            w="100%"
            ref={containerRef}
            style={
                message.state.any && !message.state.generating
                    ? {display: "flex", gap: 10, justifyContent: "center"}
                    : {}
            }
        >
            {showContent ? (
                <>
                    <MessageBodyContent message={message} containerWidth={containerWidth}/>
                </>
            ) : (
                <div style={{flex: 1}}>
                    <Skeleton height={10} radius="md"/>
                    <Skeleton height={10} width="70%" mt={10} mb={20} radius="md"/>
                </div>
            )}
        </Box>
    );
}
