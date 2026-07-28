import { Avatar, Image, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { PathUtils } from "@tiny-chat/shared/src/features/file/utils/PathUtils.ts";
import { useState } from "react";
import {
	FilePreview,
	type FilePreviewItem,
} from "#frontend/features/file/components/FilePreview.tsx";
import { trpc } from "#frontend/utils/api.ts";
import { theme } from "#frontend/utils/icon.ts";
import { UploadType } from "#shared/features/file/types/upload.ts";

// TODO - getUploads returns out-of-order.
// TODO - lazy load each upload in the preview component itself

export default function FileThumbnails({
	uploads,
	size = 30,
}: {
	uploads: { id: string; name: string; thumbnail?: string }[];
	size?: number;
	width?: number | string;
	maxHeight?: number;
}) {
	const [opened, { open, close }] = useDisclosure(false);
	const [initialIndex, setInitialIndex] = useState(0);
	const [fileData, setFileData] = useState<FilePreviewItem[] | null>(null);
	const loadFileData = useMutation({
		mutationKey: ["load-file-data"] as const,
		mutationFn: async () => {
			return await trpc.upload.getUploads.query({
				where: {
					type: UploadType.ATTACHMENT,
					id: {
						in: uploads.map((upload) => upload.id),
					},
				},
			});
		},
	});

	return (
		<>
			<FilePreview
				key={initialIndex}
				opened={opened}
				onClose={close}
				items={fileData}
				initialIndex={initialIndex}
			/>
			<Avatar.Group>
				{uploads.map((upload, i) => {
					const iconId = theme?.getFileIconId(
						upload.name ?? "",
						undefined,
						false,
					);
					const icon = iconId ? theme?.getIconContent(iconId, "base64") : null;
					return (
						<Tooltip
							label={upload.name}
							key={upload.name}
							color="gray"
							position="bottom"
						>
							<Avatar
								radius="xl"
								size={size}
								src={upload.thumbnail ?? null}
								bd="2px solid var(--mantine-color-default-border)"
								style={{ cursor: "pointer" }}
								onClick={() => {
									loadFileData
										.mutateAsync()
										.then((data) => {
											setFileData(
												data.uploads.map((data, i) => {
													if (data?.files.length !== 1)
														return {
															name: uploads[i].name,
															data: "[failed to load]",
															mime: "text/plain",
														};
													const file = data.files[0];
													let binary = "";
													const length = file.data.length;
													for (let i = 0; i < length; i++) {
														binary += String.fromCharCode(file.data[i]);
													}
													return {
														name: PathUtils.name(file),
														mime: file.mime,
														data: btoa(binary),
													};
												}),
											);
											setInitialIndex(i);
											open();
										})
										.catch(console.error);
								}}
							>
								<Image
									src={
										upload.thumbnail ??
										`data:${icon?.mimeType};base64,${icon?.data}`
									}
									w="auto"
									h={20}
								/>
							</Avatar>
						</Tooltip>
					);
				})}
			</Avatar.Group>
		</>
	);
}
