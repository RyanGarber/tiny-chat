import { Icon } from "@iconify/react";
import { Image } from "@mantine/core";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { theme } from "#app/core/utils/IconUtils.ts";

export default function Attachment({
	source,
	directory,
	name,
	grabbable,
}: {
	source: string;
	directory?: boolean;
	/** Stands in for the path when it says nothing, as an upload's id does. */
	name?: string;
	grabbable?: boolean;
}) {
	const iconId = !directory
		? theme?.getFileIconId(source, undefined, false)
		: theme?.getFolderIconId(source, false, false);
	const icon = iconId ? theme?.getIconContent(iconId, "base64") : null;

	const web = !!PathUtils.hostname(source);

	return (
		<span
			className={`inline-flex items-center gap-1 text-sm! font-medium rounded-xl px-2 bg-(--mantine-color-default-hover) ${grabbable ? "cursor-grab" : "cursor-default"}`}
		>
			{web ? (
				<Icon icon="lucide:link" />
			) : (
				icon && (
					<Image
						src={`data:${icon.mimeType};base64,${icon.data}`}
						alt={PathUtils.name(source)}
						w="auto"
						h={20}
						mt={-5}
						pt={5}
					/>
				)
			)}{" "}
			<span className={`py-1`}>
				{name ?? PathUtils.name(source)}
				{directory ? "/" : ""}
			</span>
		</span>
	);
}
