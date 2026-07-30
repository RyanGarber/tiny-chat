import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { UploadType } from "../../../../generated/prisma/enums.ts";
import { AuthServer } from "../../../core/AuthServer.ts";
import { UploadUtils } from "../utils/UploadUtils.ts";
import { FileService } from "./FileService.ts";

interface GitHubRepository {
	id: number;
	full_name: string;
	name: string;
	description: string | null;
	private: boolean;
	html_url: string;
	updated_at: string;
	default_branch: string;
}

/**
 * GitHub connection and cloning.
 */
export const GitHubService = {
	/**
	 * Get an up-to-date access token for a user's GitHub.
	 */
	getToken: async ({ user }: { user: zUser }) => {
		const result = await AuthServer.api.getAccessToken({
			body: {
				providerId: "github",
				userId: user.id,
			},
		});

		return result?.accessToken;
	},

	/**
	 * Get a list of all repositories the user has access to.
	 */
	getRepositories: async ({ user }: { user: zUser }) => {
		const token = await GitHubService.getToken({ user });

		const pages: GitHubRepository[] = [];
		let page = 1;
		while (true) {
			const res = await fetch(
				`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/vnd.github+json",
						"X-GitHub-Api-Version": "2026-03-10",
					},
				},
			);
			if (!res.ok) {
				console.error("GitHub API error:", await res.text());
				throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
			}
			const data = (await res.json()) as GitHubRepository[];
			if (!data.length) break;
			pages.push(...data);
			if (data.length < 100) break;
			page++;
		}

		return pages;
	},

	/**
	 * Clone a repository into the user's uploads.
	 */
	cloneRepository: async ({
		user,
		owner,
		repository,
		branch,
	}: {
		user: zUser;
		owner: string;
		repository: string;
		branch: string;
	}) => {
		const token = await GitHubService.getToken({ user });

		const uploadName = `${owner}/${repository} @ ${branch}`;

		const result = await fetch(
			`https://api.github.com/repos/${owner}/${repository}/zipball/${branch}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
			},
		);

		if (!result.ok || !result.body) {
			console.error("GitHub API error:", await result.text());
			throw new Error(
				`GitHub API error: ${result.status} ${result.statusText}`,
			);
		}

		console.log(`cloning repo: ${uploadName}`);

		return await FileService.uploadZip({
			user,
			zip: await result.arrayBuffer(),
			create: {
				type: UploadType.GITHUB,
			},
			connect: {
				name: uploadName,
			},
			include: (path) => UploadUtils.shouldIncludeFile({ path }),
			skipRoot: true,
		});
	},
} as const;
