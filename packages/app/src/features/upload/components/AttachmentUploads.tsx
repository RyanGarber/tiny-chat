import {
	ActionIcon,
	Card,
	Group,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { client } from "#app/client.ts";
import Sentinel from "#app/core/components/Sentinel.tsx";
import { useSentinel } from "#app/core/hooks/useSentinel.ts";
import Dropzone from "#app/features/upload/components/Dropzone.tsx";
import FileTag from "#app/features/upload/components/FileTag.tsx";
import { MessagingService } from "#client/src/features/chat/services/MessagingService.ts";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";

export function AttachmentUploads({ close }: { close: () => void }) {
	const { attachmentUploads, deleteUpload } = useUploads();

	const { viewportRef, sentinelRef } = useSentinel({
		query: attachmentUploads,
		queryKey: client.query.upload.getUploads.pathKey(),
	});

	return (
		<Stack h="100%">
			<Dropzone kind="ATTACHMENT" />
			<ScrollArea h={300} viewportRef={viewportRef}>
				<Stack gap="xs">
					{attachmentUploads.data?.pages.flatMap((page) => page.uploads)
						.length === 0 && (
						<Text size="sm" c="dimmed" ta="center" py="xl">
							No recent uploads
						</Text>
					)}
					{attachmentUploads.data?.pages
						.flatMap((page) => page.uploads)
						.map((upload) => (
							<Card
								key={upload.id}
								p="xs"
								withBorder
								style={{ cursor: "pointer" }}
								onClick={() => {
									void MessagingService.attachUpload({ client, upload });
									close();
								}}
							>
								<Group justify="space-between" wrap="nowrap" gap="xs">
									<FileTag
										path={upload.name}
										directory={true}
										thumbnail={upload.thumbnail ?? undefined}
										size={30}
										style={{ minWidth: 0, flex: 1 }}
										gap={10}
										viewable={false}
									>
										<Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
											<Text
												size="sm"
												fw={500}
												style={{
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{upload.name}
											</Text>
											<Text size="xs" c="dimmed">
												{upload.createdAt
													? CommonUtils.formatDate({
															date: upload.createdAt,
															relative: true,
														})
													: ""}
											</Text>
										</Stack>
									</FileTag>
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={(e) => {
											e.stopPropagation();
											void deleteUpload.mutate({ id: upload.id });
										}}
										loading={
											deleteUpload.isPending &&
											deleteUpload.variables.id === upload.id
										}
										disabled={
											deleteUpload.isPending &&
											deleteUpload.variables.id === upload.id
										}
									>
										<TrashIcon size={18} />
									</ActionIcon>
								</Group>
							</Card>
						))}
					<Sentinel
						isFetching={attachmentUploads.isFetching}
						ref={sentinelRef}
					/>
				</Stack>
			</ScrollArea>
		</Stack>
	);
}
