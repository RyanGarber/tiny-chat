import { useQuery } from "@tanstack/react-query";
import { useChatFiles } from "@tiny-chat/client/src/features/chat/hooks/useChatFiles.ts";
import { FileExtractionService } from "@tiny-chat/core/src/features/file/services/FileExtractionService.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { client } from "#app/client.ts";

/**
 * A file as readable text.
 *
 * Most files only need decoding, which is immediate. A PDF, a Word document or
 * a spreadsheet has to be unpacked by a converter that is loaded on demand, so
 * this reports a loading state for those and nothing else — a preview of a
 * source file should not flash.
 */
export const useFileViewer = ({
	file,
}: {
	file: { path: string; directory: boolean };
}) => {
	const { readChatFile, readChatDirectory } = useChatFiles();

	return useQuery<{
		image?: string;
		text?: string | null;
		extracted?: boolean;
		directory?: boolean;
		items?: { path: string; directory: boolean }[];
	}>({
		queryKey: ["useFileViewer", "data", file.path, file.directory],
		queryFn: async () => {
			const name = PathUtils.name(file);

			if (file.directory) {
				let items: { path: string; directory: boolean }[];
				if (PathUtils.fromMount(file)) {
					items = (await readChatDirectory.mutateAsync(file)).map((item) => ({
						path: item.uri,
						directory: item.isDirectory,
					}));
				} else {
					if (!client.shell) throw new Error("local files not available");
					items = (await client.shell.readDir(file)).map((item) => ({
						path: item.path,
						directory: item.is_dir,
					}));
				}
				return { directory: true, items };
			}

			let data: { data: Uint8Array; mime?: string };
			if (PathUtils.fromMount(file)) {
				data = await readChatFile.mutateAsync(file);
			} else {
				if (!client.shell) throw new Error("local files not available");
				data = await client.shell.readFile(file);
			}

			data.mime ??= await FileTypeUtils.getMime({
				path: file.path,
				data: data.data,
			});

			if (data.mime?.startsWith("image/")) {
				return {
					image: `data:${data.mime};base64,${FileUtils.getBase64FromBytes({ data: data.data })}`,
					extracted: false,
				};
			}

			const extracted = await FileExtractionService.extract({
				data: FileUtils.getBufferFromBytes({ data: data.data }),
				name,
				mime: data.mime,
			});

			if (FileExtractionService.canExtract({ name, mime: data.mime })) {
				return {
					text: extracted,
					extracted: true,
				};
			}

			return {
				text: FileUtils.getTextFromBytes({ data: data.data, mime: data.mime }),
				extracted: false,
			};
		},
	});
};
