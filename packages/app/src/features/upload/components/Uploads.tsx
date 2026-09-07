import {
	Group,
	Modal,
	Overlay,
	Portal,
	Stack,
	Tabs,
	Text,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { FileIcon, GithubLogoIcon, UploadIcon } from "@phosphor-icons/react";
import { type UploadsType, useAppStore } from "#app/core/stores/useAppStore.ts";
import { AttachmentUploads } from "#app/features/upload/components/AttachmentUploads.tsx";
import { GitHubUploads } from "#app/features/upload/components/GitHubUploads.tsx";
import { useFileDrag } from "#app/features/upload/hooks/useFileDrag.ts";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";

export default function Uploads() {
	const { upload } = useUploads();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const currentUploads = useAppStore((state) => state.currentUploads);
	const setCurrentUploads = useAppStore((state) => state.setCurrentUploads);
	const draggingFiles = useFileDrag(currentModal !== "uploads");

	return (
		<>
			<Portal>
				<Dropzone
					onDrop={(files) =>
						files.forEach((file) => {
							upload.mutate({ kind: "ATTACHMENT", file });
						})
					}
					activateOnClick={false}
					activateOnKeyboard={false}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: "calc(var(--mantine-z-index-modal) - 1)",
						opacity: draggingFiles ? 1 : 0,
						pointerEvents: draggingFiles ? "all" : "none",
					}}
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
					{/* Window-level file detection controls visibility, including when
					    the webview does not report an accepted drag to this dropzone. */}
					<Overlay blur={3}>
						<Group
							justify="center"
							align="center"
							style={{ height: "100%", width: "100%" }}
						>
							<UploadIcon size={50} color="var(--mantine-color-blue-6)" />
							<Stack gap={0} align="center">
								<Text size="xl" inline style={{ textAlign: "center" }}>
									Drop files here to upload
								</Text>
							</Stack>
						</Group>
					</Overlay>
				</Dropzone>
			</Portal>
			<Modal
				opened={currentModal === "uploads"}
				onClose={() => setCurrentModal(null)}
				title="Uploads"
				size="lg"
				centered
			>
				<Tabs
					value={currentUploads}
					onChange={(value) => setCurrentUploads(value as UploadsType)}
					variant="pills"
				>
					<Tabs.List mb="md">
						<Tabs.Tab value="attachment" leftSection={<FileIcon size={18} />}>
							Files
						</Tabs.Tab>
						<Tabs.Tab value="github" leftSection={<GithubLogoIcon size={18} />}>
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
