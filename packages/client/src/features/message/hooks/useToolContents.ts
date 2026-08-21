import { useQuery } from "@tanstack/react-query";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { FileEditUtils } from "@tiny-chat/core/src/features/file/utils/FileEditUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ToolCallDisplayType } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";

/**
 * Resolves what to show for a tool call that asks the user for something,
 * along with the file a `write_file` or `edit_file` call would change.
 */
export const useToolContents = ({
	message,
	part,
	display,
}: {
	message: MessageState;
	part: Extract<RenderedPart, { type: "toolCall" }>;
	display: ToolCallDisplayType;
}) => {
	const client = useContext(ClientContext);
	const { filesystem } = useChatFiles();

	const path =
		display?.name === "write_file" || display?.name === "edit_file"
			? display.input.path
			: undefined;

	const contents = useQuery({
		queryKey: ["useToolCallInput", "contents", message.id, part.id, filesystem],
		enabled: path !== undefined,
		queryFn: async (): Promise<{ fileBefore?: string; fileAfter?: string }> => {
			const edit = (
				before: string | null,
				details: Extract<ToolCallDisplayType, { name: "edit_file" }>,
			) => {
				if (!before) return undefined;
				try {
					return FileEditUtils.apply({
						content: before,
						old_string: details.input.old_string,
						new_string: details.input.new_string,
						replace_all: details.input.replace_all,
					}).content;
				} catch (error) {
					console.warn("[useToolCallInput] could not apply edit:", error);
					return undefined;
				}
			};

			if (path === undefined) {
				return {};
			}

			try {
				const uri = PathUtils.fromMount({ path });
				if (uri) {
					const file = await client.api.file.getFile.query({
						...filesystem,
						path: uri.path,
					});
					const before = FileUtils.getTextFromBytes(file);
					return {
						fileBefore: before ?? undefined,
						fileAfter:
							display?.name === "edit_file"
								? edit(before, display)
								: display?.name === "write_file"
									? display.input.content
									: undefined,
					};
				}

				if (!client.shell) return {};

				let before: string | null = null;
				try {
					const file = await client.shell.readFile({ path });
					const mime = await FileTypeUtils.getMime({
						data: file.data,
						path: file.path,
						fallback: "text/plain",
					});
					before = FileUtils.getTextFromBytes({ data: file.data, mime });
				} catch (error) {
					if (display.name === "edit_file") throw error;
				}

				return {
					fileBefore: before ?? undefined,
					fileAfter:
						display?.name === "edit_file"
							? edit(before, display)
							: display?.name === "write_file"
								? display.input.content
								: undefined,
				};
			} catch (error) {
				// A new file has nothing to diff against.
				console.warn("[useToolCallInput] could not read file:", error);
				return {};
			}
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { contents };
};
