import { Icon } from "@iconify/react";
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
import { useState } from "react";
import type {
	UploadType,
	zUploadResult,
} from "#core/features/file/types/upload.ts";
import { GLASS_STYLE } from "#ui/utils/style.ts";
import { useUploads } from "../hooks/useUploads";

export default function Dropzone({
	type,
	options,
	...props
}: Partial<DropzoneProps> & {
	type: UploadType;
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
					for (const file of files) {
						setUploads((prev) =>
							new Map(prev).set(file, { progress: Math.random() * 25 }),
						);
						upload.mutate(
							{
								type,
								file,
							},
							{
								...options,
								onError: (error, ...rest) => {
									setUploads((prev) =>
										new Map(prev).set(file, { progress: 100, error: error }),
									);
									options?.onError?.(error, ...rest);
								},
								onSuccess: (data, ...rest) => {
									// TODO - replace with onResult, call when deleting too
									setUploads((prev) =>
										new Map(prev).set(file, {
											progress: 100,
											result: data,
										}),
									);
									options?.onSuccess?.(data, ...rest);
								},
							},
						);
					}
				}}
			>
				<Group
					justify="center"
					gap="xl"
					style={{ pointerEvents: "none" }}
					h="100%"
				>
					<MantineDropzone.Accept>
						<Icon
							icon="lucide:upload"
							height={50}
							color="var(--mantine-color-blue-6)"
						/>
					</MantineDropzone.Accept>
					<MantineDropzone.Reject>
						<Icon
							icon="lucide:x"
							height={50}
							color="var(--mantine-color-red-6)"
						/>
					</MantineDropzone.Reject>
					<MantineDropzone.Idle>
						<Icon
							icon="lucide:file-up"
							height={50}
							color="var(--mantine-color-dimmed)"
						/>
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
						<Card key={file.name} style={{ ...GLASS_STYLE }} w="100%">
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
											<Icon icon="lucide:x" height={16} />
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
