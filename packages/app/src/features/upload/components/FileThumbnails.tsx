import { Avatar, Image, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useMemo, useState } from "react";
import { client } from "#app/client.ts";
import { theme } from "#app/core/utils/IconUtils.ts";
import {
	FilePreview,
	type FilePreviewItem,
} from "#app/features/upload/components/FilePreview.tsx";
import { UploadType } from "#core/features/file/types/upload.ts";

// TODO - getUploads returns out-of-order.
//      - lazy load each upload in the preview component itself

export default function FileThumbnails({
	uploads,
	size = 30,
}: {
	uploads: { id: string; name: string; thumbnail?: Uint8Array | null }[];
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
			return await client.api.upload.getUploads.query({
				where: {
					type: UploadType.ATTACHMENT,
					id: {
						in: uploads.map((upload) => upload.id),
					},
				},
				files: true,
			});
		},
	});

	const thumbnails = useMemo(() => {
		const result: Record<string, string> = {};
		uploads.forEach((upload) => {
			if (upload.thumbnail) {
				result[upload.id] =
					`data:image/webp;base64,${FileUtils.getBase64FromBytes({ data: upload.thumbnail })}`;
			}
		});
		return result;
	}, [uploads]);

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
								src={thumbnails[upload.id]}
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
										thumbnails[upload.id] ??
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
