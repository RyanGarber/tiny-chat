import { Group, type GroupProps, Image } from "@mantine/core";
import { BrainIcon, BrowserIcon, LightningIcon } from "@phosphor-icons/react";
import { type HTMLAttributes, type ReactNode, useMemo } from "react";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { FileUtils } from "#core/features/file/utils/FileUtils.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { zWebContext } from "#core/features/provider/types/web.ts";
import { useAppStore } from "#gui/core/stores/useAppStore.ts";
import { useChatSourcesStore } from "#gui/features/chat/stores/useChatSourcesStore.ts";
import { FileIcon } from "#gui/generated/stylicious/index.js";
import MaterialIconTheme from "#gui/generated/stylicious/material-icon-theme.js";

export default function SourceTag({
	path,
	web,
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
	web?: zWebContext;
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
	const viewFile = useChatSourcesStore((state) => state.viewFile);
	const chatId = useChatStore((state) => state.active.chatId);

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
	} else if (path.startsWith("memory:")) {
		icon = <BrainIcon size={size} />;
	} else if (path.startsWith("action:")) {
		icon = <LightningIcon size={size} />;
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
				viewFile({ path, directory, chatId, web });
				setAsideOpen(true);
			};
			return {
				role: "button",
				tabIndex: 0,
				onClick: open,
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						open();
					}
				},
				style: {
					cursor: directory ? undefined : "pointer",
				},
			};
		}
		return {};
	}, [viewable, directory, path, chatId, web, setAsideOpen, viewFile]);

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
