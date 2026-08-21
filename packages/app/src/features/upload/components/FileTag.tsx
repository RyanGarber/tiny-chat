import { Icon } from "@iconify/react";
import { Group, type GroupProps, Image } from "@mantine/core";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { type HTMLAttributes, type ReactNode, useMemo, useState } from "react";
import { FileViewer } from "#app/features/upload/components/FileViewer.tsx";
import { FileIcon } from "#app/generated/index.js";
import MaterialIconTheme from "#app/generated/material-icon-theme.js";

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
	const [isViewing, setIsViewing] = useState(false);

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
		icon = <Icon icon={"lucide:link"} height={size} />;
	} else {
		icon = (
			<FileIcon
				theme={MaterialIconTheme as any}
				path={path}
				directory={directory}
				expanded={expanded}
				style={{ width: size, height: size }}
			/>
		);
	}

	const events = useMemo<HTMLAttributes<HTMLElement>>(() => {
		if (viewable) {
			return {
				onClick: () => {
					setIsViewing(true);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						setIsViewing(true);
					}
				},
				style: {
					cursor: "pointer",
				},
			};
		}
		return {};
	}, [viewable]);

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
				{isViewing && (
					<FileViewer
						opened={isViewing}
						onClose={() => setIsViewing(false)}
						files={[{ path, directory }]}
					/>
				)}
			</>
		);
	}

	return (
		<>
			<Group gap={5} {...events} {...props}>
				{icon}
				{children}
			</Group>
			{isViewing && (
				<FileViewer
					opened={isViewing}
					onClose={() => setIsViewing(false)}
					files={[{ path, directory }]}
				/>
			)}
		</>
	);
}
