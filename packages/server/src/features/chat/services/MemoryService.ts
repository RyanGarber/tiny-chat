import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	MemoryCategory,
	MemoryStability,
} from "../../../../generated/prisma/enums.ts";
import { MemoryUtils } from "../utils/MemoryUtils.ts";
import { MemoryRetrievalService } from "./MemoryRetrievalService.ts";

type MemoryInput = {
	user: zUser;
	message?: MessageLike | null;
	fact: string;
	category: MemoryCategory;
	stability: MemoryStability;
	evidence: string[];
	confidence: number;
};

export const MemoryService = {
	getMemories: async ({ user }: { user: zUser }) =>
		(
			await globalThis.db.orm.public.Memory.where({ userId: user.id }).all()
		).map(MemoryUtils.toMemoryState),

	createMemory: async (input: MemoryInput) => MemoryService.saveMemory(input),
	updateMemory: async (input: MemoryInput & { id: string }) =>
		MemoryService.saveMemory(input),

	saveMemory: async ({
		user,
		message,
		...input
	}: MemoryInput & { id?: string }) => {
		const { id, ...values } = input;
		const messageId = typeof message === "string" ? message : message?.id;
		const source = messageId
			? await globalThis.db.orm.public.Message.where({
					id: messageId,
					userId: user.id,
				})
					.select("id", "config", "createdAt")
					.first()
			: undefined;
		if (messageId && !source) throw new Error("Message not found");
		// Embed before opening the transaction. New/updated facts are immediately searchable.
		const embedding = await MemoryRetrievalService.embed({
			user,
			text: values.fact,
		});
		return globalThis.db.transaction(async (tx) => {
			const data = {
				...values,
				...(source
					? {
							messageId: source.id,
							config: source.config,
							createdAt: source.createdAt,
						}
					: {}),
			};
			const memory = id
				? await tx.orm.public.Memory.where({ id, userId: user.id }).update(data)
				: await tx.orm.public.Memory.create({
						...data,
						id: CommonUtils.getRandomId(),
						userId: user.id,
					});
			if (!memory) throw new Error("Memory not found");
			await tx.execute(
				globalThis.db.raw.sql`
				UPDATE memory SET embedding = NULLIF(${embedding ? JSON.stringify(embedding) : ""}, '')::vector
				WHERE id = ${memory.id} AND "userId" = ${user.id}
			`
					.affectedCount()
					.build(),
			);
			return MemoryUtils.toMemoryState(memory);
		});
	},

	deleteMemory: async ({ user, id }: { user: zUser; id: string }) =>
		globalThis.db.transaction(async (tx) => {
			const memory = await tx.orm.public.Memory.where({
				id,
				userId: user.id,
			}).first();
			if (!memory) throw new Error("Memory not found");
			await tx.orm.public.ChatMemory.where({ memoryId: id }).deleteAll();
			await tx.orm.public.Memory.where({ id, userId: user.id }).delete();
			return MemoryUtils.toMemoryState(memory);
		}),
} as const;
