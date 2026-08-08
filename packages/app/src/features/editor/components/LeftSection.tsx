import { Icon } from "@iconify/react";
import { ActionIcon, Menu } from "@mantine/core";
import { useIsMutating } from "@tanstack/react-query";
import { AppService } from "#app/core/services/AppService.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import {
	FileMenuItem,
	RepositoryMenuItem,
	ScreenshotMenuItem,
} from "#app/features/upload/components/Uploads.tsx";
import { uploadMutationKey } from "#app/features/upload/hooks/useUploads.ts";

export default function LeftSection({ isAny }: { isAny: boolean }) {
	const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;

	return (
		<Menu position="top-start" transitionProps={{ transition: "fade-up" }}>
			<Menu.Target>
				<ActionIcon
					variant="subtle"
					color="var(--mantine-color-text)"
					radius={20}
					size={40}
					disabled={isAny}
					loading={isUploading}
				>
					<Icon icon="lucide:paperclip" height={18} />
				</ActionIcon>
			</Menu.Target>
			<Menu.Dropdown style={{ boxShadow: StyleUtils.shadow }}>
				<FileMenuItem
					onClick={() => AppService.openUploads("attachment")}
					disabled={isAny}
				/>
				<RepositoryMenuItem
					onClick={() => AppService.openUploads("github")}
					disabled={isAny}
				/>
				<ScreenshotMenuItem disabled={isAny} />
			</Menu.Dropdown>
		</Menu>
	);
}
