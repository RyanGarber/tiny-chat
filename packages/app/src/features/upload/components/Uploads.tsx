import { Icon } from "@iconify/react";
import { Group, Modal, Overlay, Stack, Tabs, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { type UploadsType, useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { AttachmentUploads } from "#app/features/upload/components/AttachmentUploads.tsx";
import { GitHubUploads } from "#app/features/upload/components/GitHubUploads.tsx";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";
import { UploadType } from "#core/features/file/types/upload";

export default function Uploads() {
	const { upload } = useUploads();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const currentUploads = useAppStore((state) => state.currentUploads);
	const setCurrentUploads = useAppStore((state) => state.setCurrentUploads);

	return (
		<>
			<Dropzone.FullScreen
				onDrop={(files) =>
					files.forEach((file) => {
						upload.mutate({ type: UploadType.ATTACHMENT, file });
					})
				}
				zIndex="calc(var(--mantine-z-index-modal) - 1)"
				active={currentModal !== "uploads"}
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
				opened={currentModal === "uploads"}
				onClose={() => setCurrentModal(null)}
				title="Uploads"
				size="lg"
				styles={{ content: StyleUtils.glass }}
				centered
			>
				<Tabs
					value={currentUploads}
					onChange={(value) => setCurrentUploads(value as UploadsType)}
					variant="pills"
				>
					<Tabs.List mb="md">
						<Tabs.Tab
							value="attachment"
							leftSection={<Icon icon="lucide:file" height={16} />}
						>
							Files
						</Tabs.Tab>
						<Tabs.Tab
							value="github"
							leftSection={<Icon icon="lucide:github" height={16} />}
						>
							GitHub
						</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panel value="attachment">
						<AttachmentUploads close={() => setCurrentModal(null)} />
					</Tabs.Panel>

					<Tabs.Panel value="github">
						<GitHubUploads close={() => setCurrentModal(null)} />
					</Tabs.Panel>
				</Tabs>
			</Modal>
		</>
	);
}
