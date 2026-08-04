import { useQuery } from "@tanstack/react-query";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { FileEditUtils } from "@tiny-chat/core/src/features/file/utils/FileEditUtils.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import {
	type ToolCallInputDetails,
	ToolCallUtils,
} from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useContext, useMemo } from "react";
import { ClientProvider } from "../../../client.ts";
import { useTools } from "../../agent/hooks/useTools.ts";

/**
 * Resolves what to show for a tool call that asks the user for something,
 * along with the file a `write_file` or `edit_file` call would change.
 */
export const useToolCallInput = ({
	message,
	toolCall,
	toolResult,
}: {
	message: MessageState;
	toolCall: Extract<zDataPart, { type: "toolCall" }>;
	toolResult?: Extract<zDataPart, { type: "toolResult" }>;
}) => {
	const client = useContext(ClientProvider);

	const { toolsets } = useTools();

	const { tool } = ToolUtils.find({ toolsets, part: toolCall });

	const input = useMemo(
		() => ToolCallUtils.getInput({ toolCall, toolResult, toolsets }),
		[toolCall, toolResult, toolsets],
	);

	const path =
		input?.details?.kind === "write_file" ||
		input?.details?.kind === "edit_file"
			? input.details.path
			: undefined;

	const contents = useQuery({
		queryKey: ["toolCallInput", "contents", message.chatId, path],
		enabled: path !== undefined,
		queryFn: async (): Promise<{ fileBefore?: string; fileAfter?: string }> => {
			const edit = (
				before: string | null,
				details: Extract<ToolCallInputDetails, { kind: "edit_file" }>,
			) => {
				if (!before) return undefined;
				try {
					return FileEditUtils.apply({
						content: before,
						old_string: details.old_string,
						new_string: details.new_string,
						replace_all: details.replace_all,
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
						chat: message.chatId,
						path: uri.path,
					});
					const before = FileUtils.getTextFromBytes(file);
					return {
						fileBefore: before ?? undefined,
						fileAfter:
							input?.details?.kind === "edit_file"
								? edit(before, input.details)
								: input?.details?.kind === "write_file"
									? input.details.content
									: undefined,
					};
				}

				if (!client.shell) return {};

				const file = await client.shell.readFile({ path });
				const mime = await FileTypeUtils.getMime({
					data: file.data,
					path: file.path,
					fallback: "text/plain",
				});
				const before = FileUtils.getTextFromBytes({ data: file.data, mime });
				return {
					fileBefore: before ?? undefined,
					fileAfter:
						input?.details?.kind === "edit_file"
							? edit(before, input.details)
							: input?.details?.kind === "write_file"
								? input.details.content
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

	return { tool, input, contents };
};
