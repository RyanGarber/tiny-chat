import { createId } from "@paralleldrive/cuid2";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type { Session } from "better-auth";

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
		const id = createId();
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
		if (!clone.userId) return false;
		clones.splice(clones.indexOf(clone), 1);
		await globalThis.prisma.session.update({
			where: { id: session.id },
			data: { user: { connect: { id: clone.userId } } },
		});
		return true;
	},
} as const;
