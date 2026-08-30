import { ActionIcon, Menu } from "@mantine/core";
import {
	FileIcon,
	GithubLogoIcon,
	PaperclipIcon,
	ScreencastIcon,
} from "@phosphor-icons/react";
import { useIsMutating } from "@tanstack/react-query";
import { AppService } from "#app/core/services/AppService.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { useScreenshot } from "#app/features/upload/hooks/useScreenshot.ts";
import { uploadMutationKey } from "#client/src/features/upload/hooks/useUploads.ts";

export default function LeftSection({ disabled }: { disabled: boolean }) {
	const { isScreenshotSupported, uploadScreenshot } = useScreenshot();

	const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;

	return (
		<Menu position="top-start" transitionProps={{ transition: "fade-up" }}>
			<Menu.Target>
				<ActionIcon
					variant="subtle"
					color="var(--mantine-color-text)"
					radius={20}
					size={40}
					disabled={disabled}
					loading={isUploading}
				>
					<PaperclipIcon size={20} />
				</ActionIcon>
			</Menu.Target>
			<Menu.Dropdown style={{ boxShadow: StyleUtils.shadow }}>
				<Menu.Item
					leftSection={<FileIcon size={20} />}
					onClick={() => AppService.openUploads("attachment")}
					disabled={disabled}
				>
					File
				</Menu.Item>
				<Menu.Item
					leftSection={<GithubLogoIcon size={20} />}
					onClick={() => AppService.openUploads("github")}
					disabled={disabled}
				>
					GitHub
				</Menu.Item>
				{isScreenshotSupported && (
					<Menu.Item
						leftSection={<ScreencastIcon size={20} />}
						onClick={() => uploadScreenshot.mutate()}
						disabled={disabled || uploadScreenshot.isPending}
					>
						Screenshot
					</Menu.Item>
				)}
			</Menu.Dropdown>
		</Menu>
	);
}
