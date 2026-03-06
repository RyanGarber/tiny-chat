import {
    IconFile,
    IconFileTypeCsv,
    IconFileTypeDoc,
    IconFileTypePdf,
    IconFileTypePpt,
    IconFileTypeTxt,
    IconFileTypeZip
} from "@tabler/icons-react";
import {useState} from "react";
import {Avatar, Card, Center, Image, Modal, Stack, Tooltip} from "@mantine/core";
import {Carousel} from "@mantine/carousel";
import {useDisclosure} from "@mantine/hooks";

type IconEntry = { test: RegExp; Icon: React.ComponentType<{ size: number }> };

const mimeIconEntries: IconEntry[] = [
    {test: /pdf/, Icon: IconFileTypePdf},
    {test: /csv/, Icon: IconFileTypeCsv},
    {test: /word/, Icon: IconFileTypeDoc},
    {test: /powerpoint|presentation/, Icon: IconFileTypePpt},
    {test: /zip/, Icon: IconFileTypeZip},
    {test: /text\/plain/, Icon: IconFileTypeTxt},
];

function getIcon(mime: string | undefined, iconSize: number) {
    const entry = mimeIconEntries.find(e => e.test.test(mime ?? ""));
    const Icon = entry?.Icon ?? IconFile;
    return <Icon size={iconSize}/>;
}

export default function Attachments({list, size}: {
    list: { name?: string, mime?: string, url: string }[],
    size?: number
}) {
    size = size ?? 24;

    const [isOpen, {open, close}] = useDisclosure();
    const [slide, setSlide] = useState(0);
    const [currentSlide, setCurrentSlide] = useState(0);

    return (
        <>
            <Avatar.Group>
                {list.map((a, i) => (
                    <Tooltip label={a.name} key={a.name} color="gray" position="bottom">
                        <Avatar
                            radius="xl"
                            size={size}
                            src={a.mime?.startsWith("image/") ? a.url : null}
                            onClick={() => {
                                setSlide(i);
                                setCurrentSlide(i);
                                open();
                            }}
                        >
                            {getIcon(a.mime, size!)}
                        </Avatar>
                    </Tooltip>
                ))}
            </Avatar.Group>
            <Modal opened={isOpen} onClose={close} withCloseButton={false}>
                <Carousel
                    slideSize="100%"
                    initialSlide={slide}
                    onSlideChange={setCurrentSlide}
                    previousControlProps={{
                        style: {visibility: currentSlide === 0 ? "hidden" : "visible"}
                    }}
                    nextControlProps={{
                        style: {visibility: currentSlide === list.length - 1 ? "hidden" : "visible"}
                    }}
                >
                    {list.map((a) => (
                        <Carousel.Slide key={a.name}>
                            <Stack h="100%">
                                <Center p={5}></Center>
                                <Stack flex={1} justify="center">
                                    {a.mime?.startsWith("image/")
                                        ? <Image src={a.url}/>
                                        : <Card withBorder h={200}>
                                            <Center h="100%">
                                                {getIcon(a.mime, 64)}
                                            </Center>
                                        </Card>
                                    }
                                </Stack>
                                <Center p={5}>
                                    {a.name}
                                </Center>
                            </Stack>
                        </Carousel.Slide>
                    ))}
                </Carousel>
            </Modal>
        </>
    )
}
