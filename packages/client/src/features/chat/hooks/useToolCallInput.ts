import { useQuery } from "@tanstack/react-query";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useContext, useMemo } from "react";
import { ClientProvider } from "../../../client.ts";
import { useTools } from "../../agent/hooks/useTools.ts";

/**
 * Resolves what to show for a tool call that asks the user for something,
 * along with the file a `write_file` call would overwrite.
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

	const { tool } = ToolUtils.find({ toolsets, name: toolCall.name });

	const input = useMemo(
		() => ToolCallUtils.getInput({ toolCall, toolResult, toolsets }),
		[toolCall, toolResult, toolsets],
	);

	const path =
		input?.details?.kind === "write_file" ? input.details.path : undefined;

	const contents = useQuery({
		queryKey: ["toolCallInput", "contents", message.chatId, path],
		enabled: path !== undefined,
		queryFn: async () => {
			if (path === undefined) return "";
			try {
				const uri = PathUtils.fromMount({ path });
				if (uri) {
					const file = await client.api.file.getFile.query({
						chat: message.chatId,
						path: uri.path,
					});
					return FileUtils.getTextFromBytes(file) ?? "";
				}

				if (!client.shell) return "";

				const file = await client.shell.readFile({ path });
				const mime = await FileTypeUtils.getMime({
					data: file.data,
					path: file.path,
					fallback: "text/plain",
				});
				return FileUtils.getTextFromBytes({ data: file.data, mime }) ?? "";
			} catch (error) {
				// A new file has nothing to diff against.
				console.warn("[useToolCallInput] could not read file:", error);
				return "";
			}
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	return { tool, input, contents: contents.data ?? "" };
};
