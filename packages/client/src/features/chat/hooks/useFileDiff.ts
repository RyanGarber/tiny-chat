import { useQuery } from "@tanstack/react-query";
import { FileUtils } from "@tiny-chat/core/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { GitService } from "../services/GitService.ts";
import type { GitRepo } from "../types/chatFiles.ts";

/**
 * A file on the machine against its last commit, or null when git has nothing
 * to show for it: it is not in a repository, has not changed, is binary, or is
 * too large to have been read whole.
 */
export const useFileDiff = ({
	file,
	repos,
}: {
	file: { path: string; directory: boolean; local: boolean };
	repos: GitRepo[];
}) => {
	const client = useContext(ClientContext);
	const shell = client.shell;

	const found = useMemo(() => {
		if (!file.local || file.directory) return null;
		const path = PathUtils.normalize({ path: file.path, unix: true });
		for (const repo of repos) {
			const change = repo.changes.find((change) => change.path === path);
			if (change && !change.binary) return { repo, change };
		}
		return null;
	}, [file, repos]);

	return useQuery({
		queryKey: [
			"useFileDiff",
			file.path,
			found?.change.additions,
			found?.change.deletions,
		],
		queryFn: async () => {
			if (!shell || !found) return null;
			const [before, after] = await Promise.all([
				GitService.original({ shell, ...found }),
				shell.readFile({ path: file.path }),
			]);
			const text = FileUtils.getTextFromBytes({ data: after.data });
			if (before === null || text === null) return null;
			return { before, after: text };
		},
		enabled: !!shell && !!found,
	});
};
