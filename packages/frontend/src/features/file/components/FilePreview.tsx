import {
	Group,
	Image,
	LoadingOverlay,
	Modal,
	ScrollArea,
	SegmentedControl,
	Stack,
} from "@mantine/core";
import { FileTypeUtils } from "@tiny-chat/shared/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/shared/src/features/file/utils/FileUtils.ts";
import { useState } from "react";
import type { BundledLanguage } from "streamdown";
import { Code } from "#frontend/core/components/Components.tsx";

export interface FilePreviewItem {
	name: string;
	data: string;
	mime: string;
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
							{items[selected].mime.startsWith("image/") ? (
								<Image
									src={`data:${items[selected].mime};base64,${items[selected].data}`}
									alt={items[selected].name}
									mah="80vh"
									w="auto"
								/>
							) : (
								<Code
									filename={items[selected].name}
									language={
										FileTypeUtils.getExtension(
											items[selected],
										) as BundledLanguage
									}
									code={
										FileUtils.getTextFromBytes(items[selected]) ??
										"// failed to decode file"
									}
								/>
							)}
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
