import { Icon } from "@iconify/react";
import { Group, Menu, Modal, Overlay, Stack, Tabs, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useCallback, useState } from "react";
import { UploadFile } from "#frontend/features/file/components/UploadFile.tsx";
import { UploadRepo } from "#frontend/features/file/components/UploadRepo.tsx";
import { isTauri } from "#frontend/utils/api.ts";
import { GLASS_STYLE } from "#frontend/utils/style.ts";
import { UploadType } from "#shared/features/file/types/upload";
import { useUploads } from "../hooks/useUploads";

export default function Upload({
	opened,
	onClose,
	tab,
	onTabChange,
}: {
	opened: boolean;
	onClose: () => void;
	tab: "file" | "repo";
	onTabChange: (tab: "file" | "repo") => void;
}) {
	const { upload } = useUploads();
	return (
		<>
			<Dropzone.FullScreen
				onDrop={(files) =>
					files.forEach((file) => {
						upload.mutate({ type: UploadType.ATTACHMENT, file });
					})
				}
				zIndex="calc(var(--mantine-z-index-modal) - 1)"
				active={!opened}
				styles={{
					inner: {
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
					},
				}}
			>
				<Dropzone.Accept>
					<Overlay>
						<Group
							justify="center"
							align="center"
							style={{ height: "100%", width: "100%" }}
						>
							<Icon
								icon="lucide:upload"
								height={50}
								color="var(--mantine-color-blue-6)"
							/>
							<Stack gap={0} align="center">
								<Text size="xl" inline style={{ textAlign: "center" }}>
									Drop files here to upload
								</Text>
							</Stack>
						</Group>
					</Overlay>
				</Dropzone.Accept>
			</Dropzone.FullScreen>
			<Modal
				opened={opened}
				onClose={onClose}
				title="Uploads"
				size="lg"
				styles={{ content: GLASS_STYLE }}
				centered
			>
				<Tabs
					value={tab}
					onChange={(val) => onTabChange(val as "file" | "repo")}
					variant="pills"
				>
					<Tabs.List mb="md">
						<Tabs.Tab
							value="file"
							leftSection={<Icon icon="lucide:file" height={16} />}
						>
							Files
						</Tabs.Tab>
						<Tabs.Tab
							value="repo"
							leftSection={<Icon icon="lucide:github" height={16} />}
						>
							Repositories
						</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panel value="file">
						<UploadFile onClose={onClose} />
					</Tabs.Panel>

					<Tabs.Panel value="repo">
						<UploadRepo onClose={onClose} />
					</Tabs.Panel>
				</Tabs>
			</Modal>
		</>
	);
}

// --- Menu Items ---

export function FileMenuItem({
	onClick,
	disabled,
}: {
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Menu.Item
			leftSection={<Icon icon="lucide:file" height={18} />}
			onClick={onClick}
			disabled={disabled}
		>
			File
		</Menu.Item>
	);
}

export function RepositoryMenuItem({
	onClick,
	disabled,
}: {
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Menu.Item
			leftSection={<Icon icon="lucide:github" height={18} />}
			onClick={onClick}
			disabled={disabled}
		>
			Repository
		</Menu.Item>
	);
}

export function ScreenshotMenuItem({ disabled }: { disabled?: boolean }) {
	// Check for support
	const [supported] = useState(() => {
		if (typeof window === "undefined") return false;
		const hasMediaDevices =
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices &&
			"getDisplayMedia" in navigator.mediaDevices;
		return hasMediaDevices && !isTauri();
	});

	const { upload } = useUploads();

	const captureScreenshot = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
			});
			const video = document.createElement("video");
			video.srcObject = stream;
			await new Promise<void>((resolve) => {
				video.onloadedmetadata = () => resolve();
			});
			await video.play();

			const canvas = document.createElement("canvas");
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;

			const context = canvas.getContext("2d");
			if (!context) {
				console.error("Failed to get canvas context for screenshot:", canvas);
				return;
			}

			context.drawImage(video, 0, 0);
			stream.getTracks().forEach((track) => {
				track.stop();
			});

			canvas.toBlob((blob) => {
				if (blob) {
					const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
					const file = new File([blob], `Screenshot-${timestamp}.png`, {
						type: "image/png",
					});
					upload.mutate({ type: UploadType.ATTACHMENT, file });
				}
			}, "image/png");
		} catch (e) {
			console.error("Failed to capture screenshot:", e);
		}
	}, [upload]);

	if (!supported) return null;

	return (
		<Menu.Item
			disabled={disabled}
			leftSection={<Icon icon="lucide:screen-share" height={18} />}
			onClick={() => void captureScreenshot()}
		>
			Screenshot
		</Menu.Item>
	);
}
