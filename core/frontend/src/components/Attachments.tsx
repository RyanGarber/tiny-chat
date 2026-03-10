import { useState } from 'react';
import {
  Avatar,
  Card,
  Center,
  Image,
  Popover,
  PopoverDropdown,
  PopoverTarget,
  Stack,
  Tooltip,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { Icon } from '@iconify/react';

type IconEntry = { test: RegExp; icon: string };

const mimeIconEntries: IconEntry[] = [
  { test: /html|css|js|ts|java|python|cpp/, icon: 'file-braces-corner' },
  { test: /zip|tar|archive/, icon: 'file-archive' },
  { test: /mp3|wav|ogg|aac/, icon: 'file-volume' },
  { test: /mp4|mov|webm/, icon: 'file-video-camera' },
  { test: /csv/, icon: 'file-chart-line' },
  { test: /word|text\/plain/, icon: 'file-text' },
  { test: /powerpoint|presentation|pdf/, icon: 'file-image' },
];

function getIcon(mime: string | undefined, iconSize: number) {
  const entry = mimeIconEntries.find((e) => e.test.test(mime ?? ''));
  return <Icon icon={`lucide:${entry?.icon ?? 'file'}`} height={iconSize} />;
}

export default function Attachments({
  list,
  size,
  width,
}: {
  list: { name?: string; mime?: string; url: string }[];
  size?: number;
  width?: number | string;
}) {
  size = size ?? 30;

  const [slide, setSlide] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <>
      <Popover
        withArrow
        arrowSize={15}
        arrowPosition="center"
        arrowOffset={15}
        withOverlay
        shadow="md"
        width={width}
        withinPortal={false}
      >
        <PopoverTarget>
          <Avatar.Group>
            {list.map((a, i) => (
              <Tooltip label={a.name} key={a.name} color="gray" position="bottom">
                <Avatar
                  radius="xl"
                  size={size}
                  src={a.mime?.startsWith('image/') ? a.url : null}
                  bd="2px solid var(--mantine-color-default-border)"
                  onClick={() => {
                    setSlide(i);
                    setCurrentSlide(i);
                  }}
                >
                  {getIcon(a.mime, size * 0.6)}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
        </PopoverTarget>
        <PopoverDropdown>
          <Carousel
            slideSize="100%"
            initialSlide={slide}
            onSlideChange={setCurrentSlide}
            previousControlProps={{
              style: { visibility: currentSlide === 0 ? 'hidden' : 'visible' },
            }}
            nextControlProps={{
              style: { visibility: currentSlide === list.length - 1 ? 'hidden' : 'visible' },
            }}
          >
            {list.map((a) => (
              <Carousel.Slide key={a.name}>
                <Stack h="100%">
                  <Center p={5}></Center>
                  <Stack flex={1} justify="center">
                    {a.mime?.startsWith('image/') ? (
                      <Image src={a.url} />
                    ) : (
                      <Card withBorder h={200}>
                        <Center h="100%">{getIcon(a.mime, 64)}</Center>
                      </Card>
                    )}
                  </Stack>
                  <Center p={5}>{a.name}</Center>
                </Stack>
              </Carousel.Slide>
            ))}
          </Carousel>
        </PopoverDropdown>
      </Popover>
    </>
  );
}
