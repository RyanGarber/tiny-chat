import type { GitHubCapability } from "#core/core/types/capability.ts";
import { createGitHubCompareTool } from "#core/features/tool/tools/github/compare.ts";
import { createGitHubListCommitsTool } from "#core/features/tool/tools/github/list_commits.ts";
import { createGitHubListIssuesTool } from "#core/features/tool/tools/github/list_issues.ts";
import { createGitHubViewCommitTool } from "#core/features/tool/tools/github/view_commit.ts";
import { createGitHubViewFileTool } from "#core/features/tool/tools/github/view_file.ts";
import { createGitHubViewIssueTool } from "#core/features/tool/tools/github/view_issue.ts";
import { createGitHubViewRepositoryTool } from "#core/features/tool/tools/github/view_repository.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createGitHubToolset: ToolsetFactory<
	Toolset<{ github: GitHubCapability }>
> = async (options) => ({
	name: "github",
	tools: [
		await createGitHubViewRepositoryTool(options),
		await createGitHubViewFileTool(options),
		await createGitHubListCommitsTool(options),
		await createGitHubViewCommitTool(options),
		await createGitHubCompareTool(options),
		await createGitHubListIssuesTool(options),
		await createGitHubViewIssueTool(options),
	],
	...options,
});
