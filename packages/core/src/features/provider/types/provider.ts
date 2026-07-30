import { z } from "zod";
import type { zUser } from "../../data/types/user.ts";

export const zProvider = z.object({
	name: z.string(),
	type: z.enum(["model", "web", "other"]),
	settings: z.array(z.string()),
});
export type zProvider = z.infer<typeof zProvider>;

export interface ProviderStatus {
	valid: boolean;
	error?: string;
}

export interface Provider<T extends ProviderStatus> extends zProvider {
	getStatus: ({ user }: { user: zUser }) => Promise<T>;
}

export interface ProviderState<T extends ProviderStatus> extends zProvider {
	status: T;
}
