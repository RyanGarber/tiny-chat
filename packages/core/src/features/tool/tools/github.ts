import type { GitHubCapability } from "../../../core/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createGitHubCompareTool } from "./github/compare.ts";
import { createGitHubListCommitsTool } from "./github/list_commits.ts";
import { createGitHubListIssuesTool } from "./github/list_issues.ts";
import { createGitHubViewCommitTool } from "./github/view_commit.ts";
import { createGitHubViewFileTool } from "./github/view_file.ts";
import { createGitHubViewIssueTool } from "./github/view_issue.ts";
import { createGitHubViewRepositoryTool } from "./github/view_repository.ts";

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
