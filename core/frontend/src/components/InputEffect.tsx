import {ActionIcon, Box, Group} from "@mantine/core";
import {IconX} from "@tabler/icons-react";
import {ReactNode} from "react";

export default function InputEffect({
                                        content,
                                        onDelete,
                                    }: {
    content: ReactNode;
    onDelete: () => void;
}) {
    return (
        <Group
            className="input-effect"
            align="center"
            gap={5}
            px={10}
            py={5}
            w="fit-content"
            bdrs={5}
            fz={14}
        >
            <ActionIcon size={20} variant="subtle" onClick={onDelete}>
                <IconX size={18}/>
            </ActionIcon>
            <Box>{content}</Box>
        </Group>
    );
}
