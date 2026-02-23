import {
    IconFile,
    IconFileTypeCsv,
    IconFileTypeDoc,
    IconFileTypePdf,
    IconFileTypePpt,
    IconFileTypeTxt,
    IconFileTypeZip
} from "@tabler/icons-react";
import {JSX, useState} from "react";
import {Avatar, Card, CardSection, Center, Image, Modal, Tooltip} from "@mantine/core";
import {Carousel} from "@mantine/carousel";
import {useDisclosure} from "@mantine/hooks";

export default function Attachments({list, size}: {
    list: { name: string, mime: string, url: string }[],
    size?: number
}) {
    size = size ?? 24;

    const icons: { mimeTest: RegExp, icon: JSX.Element }[] = [
        {mimeTest: /pdf/, icon: <IconFileTypePdf size={size}/>},
        {mimeTest: /csv/, icon: <IconFileTypeCsv size={size}/>},
        {mimeTest: /word/, icon: <IconFileTypeDoc size={size}/>},
        {mimeTest: /powerpoint|presentation|/, icon: <IconFileTypePpt size={size}/>},
        {mimeTest: /zip/, icon: <IconFileTypeZip size={size}/>},
        {mimeTest: /text\/plain/, icon: <IconFileTypeTxt size={size}/>}
    ];

    const [isOpen, {open, close}] = useDisclosure();
    const [slide, setSlide] = useState(0);

    return (
        <>
            <Avatar.Group>
                {list.map((a, i) => (
                    <Tooltip label={a.name} key={a.name} color="gray">
                        <Avatar
                            radius="xl"
                            size={size}
                            src={a.mime.startsWith("image/") ? a.url : null}
                            onClick={() => {
                                setSlide(i);
                                open();
                            }}
                        >
                            {icons.find(i => i.mimeTest.test(a.mime))?.icon ?? <IconFile size={size}/>}
                        </Avatar>
                    </Tooltip>
                ))}
            </Avatar.Group>
            <Modal opened={isOpen} onClose={close} withCloseButton={false} centered>
                <Carousel slideSize="100%" initialSlide={slide}>
                    {list.map((a) => (
                        <Carousel.Slide key={a.name}>
                            <Card>
                                <CardSection>
                                    <Image
                                        src={a.mime.startsWith("image/") ? a.url : null}
                                    />
                                </CardSection>
                                <CardSection>
                                    <Center p={5}>
                                        {a.name}
                                    </Center>
                                </CardSection>
                            </Card>
                        </Carousel.Slide>
                    ))}
                </Carousel>
            </Modal>
        </>
    )
}
