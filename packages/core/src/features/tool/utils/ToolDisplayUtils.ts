import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { zFilePart } from "../../data/types/part.ts";
import { FileTypeUtils } from "../../file/utils/FileTypeUtils.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { ToolBlock } from "../types/display.ts";

/** Helpers tools use to describe their calls in `ToolBlock`s. */
export const ToolDisplayUtils = {
	/** The last segment of a path, safe on the partial input of a streaming call. */
	name: (path: string | undefined): string => {
		return path ? PathUtils.name(path) : "";
	},

	language: (path: string | undefined): string | undefined => {
		return path ? FileTypeUtils.getLanguage({ path }) : undefined;
	},

	date: (date: Date | string | null | undefined): string | undefined => {
		if (!date) return undefined;
		return CommonUtils.formatDate({ date: new Date(date), relative: true });
	},

	/** A file part as text or an image, or nothing when it is neither. */
	file: ({
		path,
		file,
	}: {
		path?: string;
		file: zFilePart;
	}): ToolBlock | undefined => {
		path ??= file.name ?? "";
		if (file.mime.startsWith("image/")) {
			return {
				type: "file",
				path,
				image: `data:${file.mime};base64,${file.data}`,
			};
		}
		const content = FileUtils.getTextFromBytes(file);
		if (content === null) return undefined;
		return {
			type: "file",
			path,
			content,
			language: FileTypeUtils.getLanguage({ mime: file.mime, path }),
		};
	},

	/** Text content for a file, typed as it is being streamed in. */
	text: ({
		path,
		content,
	}: {
		path: string | undefined;
		content: string | undefined;
	}): ToolBlock => {
		return {
			type: "file",
			path: path ?? "",
			content: content ?? "",
			language: ToolDisplayUtils.language(path),
		};
	},
} as const;
