import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { AuthServer } from "../../../core/utils/AuthServer.ts";

export const GitHubAccountService = {
	getToken: async ({ user }: { user: zUser }) => {
		const account = await globalThis.db.orm.public.Account.where({
			userId: user.id,
			providerId: "github",
		}).first();
		if (!account) return;

		const result = await AuthServer.api.getAccessToken({
			body: {
				accountId: account.id,
				userId: user.id,
			},
		});

		return result?.accessToken;
	},
} as const;
