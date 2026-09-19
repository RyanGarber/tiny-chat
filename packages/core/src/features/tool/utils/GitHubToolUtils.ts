import { z } from "zod";
import type { GitHubCapability } from "../../../core/types/capability.ts";

export const zGitHubUser = z
	.object({
		login: z.string(),
		html_url: z.string(),
	})
	.nullable();

export const zGitHubLabel = z.object({
	name: z.string(),
	color: z.string().optional(),
});

const segment = (value: string | number) => encodeURIComponent(String(value));

export const GitHubToolUtils = {
	repositoryPath: ({
		owner,
		repository,
		suffix = "",
	}: {
		owner: string;
		repository: string;
		suffix?: string;
	}) => `/repos/${segment(owner)}/${segment(repository)}${suffix}`,

	segment,

	request: async <T>({
		github,
		path,
		query,
		schema,
	}: {
		github: GitHubCapability;
		path: string;
		query?: Record<string, string | number | boolean | undefined>;
		schema: z.ZodType<T>;
	}) => schema.parse(await github.request({ path, query })),

	page: (value?: number) => Math.max(1, Math.floor(value ?? 1)),

	limit: (value: number | undefined, fallback: number, maximum = 100) =>
		Math.min(maximum, Math.max(1, Math.floor(value ?? fallback))),

	clip: (value: string | null | undefined, maximum = 20_000) => {
		if (value == null || value.length <= maximum) return value ?? null;
		return `${value.slice(0, maximum)}\n… [${value.length - maximum} more characters]`;
	},
} as const;
