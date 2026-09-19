import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { GitHubAccountService } from "../../user/services/GitHubAccountService.ts";

const API_URL = "https://api.github.com";
const API_VERSION = "2026-03-10";

export const GitHubApiService = {
	request: async ({
		user,
		path,
		query,
		preferLinkedAccount = true,
	}: {
		user: zUser;
		path: string;
		query?: Record<string, string | number | boolean | undefined>;
		preferLinkedAccount?: boolean;
	}) => {
		if (path.includes("?") || path.includes("#")) {
			throw new Error("GitHub query parameters must be supplied separately.");
		}

		const url = new URL(path, API_URL);
		if (!/^\/repos\/[^/]+\/[^/]+(?:\/|$)/.test(url.pathname)) {
			throw new Error("GitHub exploration is limited to repository resources.");
		}
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}

		let token: string | undefined;
		if (preferLinkedAccount) {
			try {
				token = await GitHubAccountService.getToken({ user });
			} catch (error) {
				console.warn(
					"Could not use linked GitHub account; trying anonymously.",
					error,
				);
			}
		}

		const request = (accessToken?: string) =>
			fetch(url, {
				headers: {
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": API_VERSION,
					...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
				},
			});

		let response = await request(token);
		if (token && response.status === 401) response = await request();

		if (!response.ok) {
			let detail = response.statusText;
			try {
				const body = (await response.json()) as { message?: unknown };
				if (typeof body.message === "string") detail = body.message;
			} catch {
				// The status text is enough when GitHub did not return JSON.
			}
			throw new Error(`GitHub API error ${response.status}: ${detail}`);
		}

		return (await response.json()) as unknown;
	},
} as const;
