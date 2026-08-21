import {
	Group,
	Image,
	Loader,
	Modal,
	ScrollArea,
	SegmentedControl,
	Stack,
	Text,
} from "@mantine/core";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useState } from "react";
import type { BundledLanguage } from "streamdown";
import Code from "#app/features/code/components/Code.tsx";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import FileTag from "#app/features/upload/components/FileTag.tsx";
import { useFileViewer } from "#app/features/upload/hooks/useFileViewer.ts";

/**
 * One file's contents. An image is shown as itself; a document is shown as the
 * markdown it extracts to, which is the only readable form of it here; anything
 * else is shown as source.
 */
function FileViewerContent({
	file,
}: {
	file: { path: string; directory: boolean };
}) {
	const content = useFileViewer({ file });

	if (content.isError) {
		return (
			<Text c="red">{CommonUtils.formatError({ error: content.error })}</Text>
		);
	}

	if (!content.data) {
		return <Loader my="md" />;
	}

	if (content.data.directory) {
		if (!content.data.items) {
			return <Loader my="md" />;
		}
		return (
			<Stack gap={5}>
				{content.data.items.map((item) => (
					<FileTag key={item.path} path={item.path} directory={item.directory}>
						<Text size="md">
							{PathUtils.name(item)}
							{item.directory && "/"}
						</Text>
					</FileTag>
				))}
			</Stack>
		);
	}

	if (content.data.image) {
		return (
			<Image
				src={content.data.image}
				alt={PathUtils.name(file)}
				mah="80vh"
				w="auto"
			/>
		);
	}

	if (!content.data.text) {
		return (
			<Code filename={file.path} code="// could not decode file" maw="100%" />
		);
	}

	return content.data.extracted ? (
		<Markdown source={content.data.text} />
	) : (
		<Code
			filename={file.path}
			language={FileTypeUtils.getExtension(file) as BundledLanguage}
			code={content.data.text}
			maw="100%"
		/>
	);
}

export function FileViewer({
	opened,
	onClose,
	files,
	initial = 0,
}: {
	opened: boolean;
	onClose: () => void;
	files: { path: string; directory: boolean }[];
	initial?: number;
}) {
	const [selected, setSelected] = useState(initial);

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			fullScreen
			zIndex={999}
			styles={{
				body: { height: "calc(100% - 60px)" },
			}}
		>
			<Stack h="100%" px={{ xs: "md", md: "xl" }} py="sm">
				<ScrollArea flex={1} style={{ overflow: "auto" }}>
					<Group justify="center" align="center">
						<FileViewerContent
							key={files[selected].path}
							file={files[selected]}
						/>
					</Group>
				</ScrollArea>
				<Group justify="center">
					<SegmentedControl
						value={String(selected)}
						onChange={(value) => setSelected(Number(value))}
						data={files.map((file, i) => ({
							value: String(i),
							label: (
								<FileTag
									path={file.path}
									directory={file.directory}
									viewable={false}
								>
									<Text flex={1} miw={0} truncate size="sm">
										{PathUtils.name(file)}
									</Text>
								</FileTag>
							),
						}))}
						styles={{
							label: {
								maxWidth: 200,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							},
						}}
					/>
				</Group>
			</Stack>
		</Modal>
	);
}
