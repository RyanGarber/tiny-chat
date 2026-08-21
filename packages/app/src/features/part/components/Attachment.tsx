import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import FileTag from "#app/features/upload/components/FileTag.tsx";

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
	return (
		<span
			className={`inline-flex items-center gap-1 text-sm! font-medium rounded-xl px-2 bg-(--mantine-color-default-hover) ${grabbable ? "cursor-grab" : "cursor-default"}`}
		>
			<FileTag path={source} directory={directory} inline className="py-1">
				{name ?? PathUtils.name(source)}
				{directory ? "/" : ""}
			</FileTag>
		</span>
	);
}
