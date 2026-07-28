import { z } from "zod";
import type { zUser } from "../../data/types/user.ts";
import type { Provider, ProviderStatus } from "./provider.ts";

export const zWebContext = z.object({
	title: z.string().optional(),
	content: z.string(),
	url: z.string(),
});
export type zWebContext = z.infer<typeof zWebContext>;

export const zWebFeature = z.enum(["search", "view"]);
export type zWebFeature = z.infer<typeof zWebFeature>;

export interface WebProvider extends Provider<ProviderStatus> {
	type: "web";
	features: zWebFeature[];

	search: (_: {
		user: zUser;
		query: string;
		maxResults: number;
	}) => Promise<zWebContext[]>;

	/**
	 * View a web page and return its context.
	 */
	view: (_: { user: zUser; url: string }) => Promise<zWebContext>;
}
