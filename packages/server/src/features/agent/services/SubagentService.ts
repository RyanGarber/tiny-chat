import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { MessageLike } from "#core/features/data/types/message.ts";
import type { zData, zMetadata } from "#core/features/data/types/part.ts";
import type { SubagentState } from "#core/features/data/types/subagent.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";

export const SubagentService = {
	/** The runs kept with these messages, each once. */
	getSubagents: async ({
		user,
		messages,
	}: {
		user: zUser;
		messages: string[];
	}): Promise<SubagentState[]> => {
		if (!messages.length) return [];
		const rows = await globalThis.db.orm.public.Message.where({
			userId: user.id,
		})
			.where((message) => message.id.in(messages))
			.select("id")
			.include("subagents", (subagent) =>
				subagent.select(
					"id",
					"partId",
					"userId",
					"data",
					"metadata",
					"createdAt",
				),
			)
			.all();
		return [
			...new Map(
				rows.flatMap((row) => row.subagents.map((s) => [s.id, s] as const)),
			).values(),
		];
	},

	/**
	 * Keeps a run with the reply holding the call that ran it. A call that runs
	 * again replaces what it kept before.
	 */
	saveSubagent: async ({
		user,
		part,
		message,
		data,
		metadata,
	}: {
		user: zUser;
		part: string;
		message: MessageLike;
		data: zData;
		metadata: zMetadata;
	}): Promise<SubagentState> => {
		const reply = await MessageService.getMessage({ user, message });
		const query = globalThis.db.orm.public.Subagent.where({
			partId: part,
			userId: user.id,
		});
		const updated = await query.update({ data, metadata });
		if (updated) return updated;
		return await globalThis.db.orm.public.Subagent.create({
			id: CommonUtils.getRandomId(),
			partId: part,
			userId: user.id,
			data,
			metadata,
			messages: (messages) => messages.connect([{ id: reply.id }]),
		});
	},
} as const;
