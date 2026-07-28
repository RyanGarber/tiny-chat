import type { FilesystemCapability } from "../../capability/types/capability.ts";
import type { ToolsetFactory } from "../types/tool.ts";
import { grep_files } from "./filesystem/grep_files.ts";
import { read_dir } from "./filesystem/read_dir.ts";
import { read_file } from "./filesystem/read_file.ts";
import { search_files } from "./filesystem/search_files.ts";
import { shell_exec } from "./filesystem/shell_exec.ts";
import { write_file } from "./filesystem/write_file.ts";

export const createFilesystemToolset: ToolsetFactory<{
	filesystem: FilesystemCapability;
}> = (options) => {
	return {
		name: "system",
		tools: [
			read_file,
			read_dir,
			search_files,
			grep_files,
			write_file,
			shell_exec,
		],
		...options,
	};
};
