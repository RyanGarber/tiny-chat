import { Group, type GroupProps, Image } from "@mantine/core";
import { BrowserIcon } from "@phosphor-icons/react";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { type HTMLAttributes, type ReactNode, useMemo } from "react";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { useChatFilesStore } from "#app/features/chat/stores/useChatFilesStore.ts";
import { FileIcon } from "../../../../generated/stylicious";
import MaterialIconTheme from "../../../../generated/stylicious/material-icon-theme.js";

export default function FileTag({
	path,
	thumbnail: thumbnailBytes,
	directory = false,
	expanded = false,
	size = 20,
	inline,
	children,
	viewable = true,
	...props
}: GroupProps & {
	path: string;
	thumbnail?: Uint8Array;
	directory?: boolean;
	expanded?: boolean;
	size?: number;
	inline?: boolean;
	children?: ReactNode;
	viewable?: boolean;
}) {
	const name = PathUtils.name(path);
	const setAsideOpen = useAppStore((state) => state.setAsideOpen);
	const viewFile = useChatFilesStore((state) => state.viewFile);
	const chatId = useChatStore((state) => state.chatId);

	const thumbnail = useMemo(() => {
		if (thumbnailBytes) {
			return `data:image/webp;base64,${FileUtils.getBase64FromBytes({ data: thumbnailBytes })}`;
		}
	}, [thumbnailBytes]);

	let icon: ReactNode;
	if (thumbnail) {
		icon = (
			<Image
				src={thumbnail}
				alt={name}
				w={size}
				h={size}
				radius="xl"
				fit="cover"
			/>
		);
	} else if (path.startsWith("web:")) {
		icon = <BrowserIcon size={size} />;
	} else {
		icon = (
			<FileIcon
				theme={MaterialIconTheme as any}
				path={path}
				directory={directory}
				expanded={expanded}
				style={{ display: "block", width: size, height: size }}
			/>
		);
	}

	const events = useMemo<HTMLAttributes<HTMLElement>>(() => {
		if (viewable) {
			const open = () => {
				viewFile({ path, directory, chatId });
				setAsideOpen(true);
			};
			return {
				onClick: open,
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						open();
					}
				},
				style: {
					cursor: directory ? undefined : "pointer",
				},
			};
		}
		return {};
	}, [viewable, directory, path, chatId, setAsideOpen, viewFile]);

	if (inline) {
		return (
			<>
				<span className="fixed" {...events}>
					{icon}
				</span>
				<span
					{...events}
					{...(props as HTMLAttributes<HTMLElement>)}
					{...{ className: `${props.className} ml-6` }}
				>
					{children}
				</span>
			</>
		);
	}

	return (
		<Group gap={5} {...events} {...props}>
			{icon}
			{children}
		</Group>
	);
}
