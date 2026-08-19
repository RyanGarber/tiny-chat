import {
	Group,
	Image,
	Loader,
	LoadingOverlay,
	Modal,
	ScrollArea,
	SegmentedControl,
	Stack,
} from "@mantine/core";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { useState } from "react";
import type { BundledLanguage } from "streamdown";
import Code from "#app/features/code/components/Code.tsx";
import { Markdown } from "#app/features/message/components/Markdown.tsx";
import { useFileText } from "#app/features/upload/hooks/useFileText.ts";

export interface FilePreviewItem {
	name: string;
	data: string;
	mime: string;
}

/**
 * One file's contents. An image is shown as itself; a document is shown as the
 * markdown it extracts to, which is the only readable form of it here; anything
 * else is shown as source.
 */
function FilePreviewContent({ item }: { item: FilePreviewItem }) {
	const { text, loading, extracted } = useFileText(item);

	if (item.mime.startsWith("image/")) {
		return (
			<Image
				src={`data:${item.mime};base64,${item.data}`}
				alt={item.name}
				mah="80vh"
				w="auto"
			/>
		);
	}

	if (loading) return <Loader my="xl" />;

	if (extracted) {
		return text ? (
			<Markdown source={text} />
		) : (
			<Code filename={item.name} code="// could not read this document" />
		);
	}

	return (
		<Code
			filename={item.name}
			language={FileTypeUtils.getExtension(item) as BundledLanguage}
			code={text ?? "// failed to decode file"}
		/>
	);
}

export function FilePreview({
	opened,
	onClose,
	items,
	initialIndex = 0,
}: {
	opened: boolean;
	onClose: () => void;
	items: FilePreviewItem[] | null;
	initialIndex?: number;
}) {
	const [selected, setSelected] = useState(initialIndex);
	return (
		<Modal
			opened={opened}
			onClose={onClose}
			fullScreen
			styles={{
				body: { height: "calc(100% - 60px)" },
			}}
		>
			<LoadingOverlay visible={!items} />
			{items && items.length > 0 && (
				<Stack h="100%">
					<ScrollArea flex={1} style={{ overflow: "auto" }}>
						<Group justify="center" align="center">
							<FilePreviewContent
								key={items[selected].name}
								item={items[selected]}
							/>
						</Group>
					</ScrollArea>
					{items && items.length > 0 && (
						<Group justify="center">
							<SegmentedControl
								value={String(selected)}
								onChange={(value) => setSelected(Number(value))}
								data={items.map((item, i) => ({
									value: String(i),
									label: item.name,
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
					)}
				</Stack>
			)}
		</Modal>
	);
}
