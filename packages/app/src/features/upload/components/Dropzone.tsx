import {
	ActionIcon,
	Box,
	Card,
	Group,
	Progress,
	Stack,
	Text,
} from "@mantine/core";
import {
	type DropzoneProps,
	Dropzone as MantineDropzone,
} from "@mantine/dropzone";
import { UploadIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";
import type {
	UploadKind,
	zUploadResult,
} from "#core/features/file/types/upload.ts";

export default function Dropzone({
	kind,
	options,
	...props
}: Partial<DropzoneProps> & {
	kind: UploadKind;
	options?: Parameters<ReturnType<typeof useUploads>["upload"]["mutate"]>[1];
}) {
	const { upload } = useUploads();

	const [uploads, setUploads] = useState<
		Map<File, { progress: number; result?: zUploadResult; error?: unknown }>
	>(new Map());

	return (
		<>
			<MantineDropzone
				{...props}
				h={120}
				styles={{ inner: { height: "100%" }, root: { cursor: "pointer" } }}
				onDrop={(files) => {
					void Promise.all(
						files.map(async (file) => {
							setUploads((prev) =>
								new Map(prev).set(file, { progress: Math.random() * 25 }),
							);
							try {
								const result = await upload.mutateAsync(
									{ kind, file },
									options,
								);
								setUploads((prev) =>
									new Map(prev).set(file, { progress: 100, result }),
								);
							} catch (error) {
								setUploads((prev) =>
									new Map(prev).set(file, { progress: 100, error }),
								);
							}
						}),
					);
				}}
			>
				<Group
					justify="center"
					gap="xl"
					style={{ pointerEvents: "none" }}
					h="100%"
				>
					<MantineDropzone.Accept>
						<UploadIcon size={50} color="var(--mantine-color-blue-6)" />
					</MantineDropzone.Accept>
					<MantineDropzone.Reject>
						<XIcon size={50} color="var(--mantine-color-red-6)" />
					</MantineDropzone.Reject>
					<MantineDropzone.Idle>
						<UploadIcon size={50} color="var(--mantine-color-dimmed)" />
					</MantineDropzone.Idle>
					<Stack gap={0} align="center">
						<Text size="xl" inline style={{ textAlign: "center" }}>
							Drag files here or click to upload
						</Text>
					</Stack>
				</Group>
			</MantineDropzone>
			<Stack gap="xs">
				{Array.from(uploads.entries())
					.filter(([, { result }]) => !result)
					.map(([file, { progress, error }]) => (
						<Card key={file.name} style={{ ...StyleUtils.glass }} w="100%">
							<Stack gap="sm">
								<Group gap={5}>
									<Box flex={1} miw={0}>
										<Text
											size="sm"
											style={{
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{file.name}
										</Text>
									</Box>
									{!!error && (
										<ActionIcon
											variant="subtle"
											color="dimmed"
											onClick={() =>
												setUploads((prev) => {
													const next = new Map(prev);
													next.delete(file);
													return next;
												})
											}
										>
											<XIcon size={18} />
										</ActionIcon>
									)}
								</Group>
								{!error && <Progress value={progress} animated />}
								{!!error && (
									<Text size="sm" c="red">
										{error instanceof Error ? error.message : "Unknown error"}
									</Text>
								)}
							</Stack>
						</Card>
					))}
			</Stack>
		</>
	);
}
