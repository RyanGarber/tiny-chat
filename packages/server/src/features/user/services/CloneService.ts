import type { Session } from "better-auth";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zUser } from "#core/features/data/types/user.ts";

interface Clone {
	id: string;
	userId: string | null;
}
const clones: Clone[] = [];

/**
 * Session cloning system for user agents without OAuth capabilities.
 */
export const CloneService = {
	createClone: (_: { user: zUser }) => {
		const id = CommonUtils.getRandomId();
		clones.push({ id, userId: null });
		return id;
	},
	continueClone: ({ user, id }: { user: zUser; id: string }) => {
		const clone = clones.find((c) => c.id === id);
		if (!clone) throw new Error("clone not found");
		clone.userId = user.id;
	},
	completeClone: async ({
		session,
		id,
	}: {
		user: zUser;
		session: Session;
		id: string;
	}) => {
		const clone = clones.find((c) => c.id === id);
		if (!clone) throw new Error("clone not found");

		const userId = clone.userId;
		if (!userId) return false;

		clones.splice(clones.indexOf(clone), 1);
		await globalThis.db.orm.public.Session.where({ id: session.id }).update({
			user: (user) => user.connect({ id: userId }),
		});
		return true;
	},
} as const;
