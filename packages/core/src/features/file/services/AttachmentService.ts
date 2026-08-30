import type {
	ShellCapability,
	WebCapability,
} from "../../../core/types/capability.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { zDataPart } from "../../data/types/message.ts";
import { FileTypeUtils } from "../utils/FileTypeUtils.ts";
import { FileUtils } from "../utils/FileUtils.ts";
import { PathUtils } from "../utils/PathUtils.ts";
import { FileOperationService } from "./FileOperationService.ts";

export const AttachmentService = {
	unavailable: ({
		source,
		label = PathUtils.name(source),
	}: {
		source: string;
		label?: string;
	}): Extract<zDataPart, { type: "attachment" }> => ({
		id: CommonUtils.getRandomId(),
		type: "attachment",
		source,
		label,
		content: { type: "unavailable" },
	}),

	build: async ({
		source,
		label = PathUtils.name(source),
		directory = false,
		shell,
		web,
	}: {
		source: string;
		label?: string;
		directory?: boolean;
		shell?: Pick<ShellCapability, "readFile" | "readDir">;
		web?: Pick<WebCapability, "view">;
	}): Promise<Extract<zDataPart, { type: "attachment" }>> => {
		const id = CommonUtils.getRandomId();
		let content: Extract<zDataPart, { type: "attachment" }>["content"];

		if (source.startsWith("web:")) {
			if (!web) throw new Error(`Cannot read web attachment: ${source}`);
			const result = await web.view({ url: source.slice(4) });
			content = {
				type: "web",
				title: result.title,
				content: result.content,
			};
		} else if (directory) {
			if (!shell)
				throw new Error(`Cannot read attachment directory: ${source}`);
			const entries = await FileOperationService.walk({
				shell,
				path: source,
				scope: "listing",
				includeDirectories: true,
			});
			content = {
				type: "directory",
				items: entries.map((entry) => ({
					path: entry.path,
					directory: entry.is_dir || undefined,
				})),
			};
		} else {
			if (!shell) throw new Error(`Cannot read attachment file: ${source}`);
			const file = await shell.readFile({ path: source });
			content = {
				type: "file",
				mime: await FileTypeUtils.getMime(file),
				data: FileUtils.getBase64FromBytes(file),
			};
		}

		return { id, type: "attachment", source, label, content };
	},
} as const;
