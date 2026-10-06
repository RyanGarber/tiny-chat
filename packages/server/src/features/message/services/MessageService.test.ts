import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import { db } from "#server/db.ts";
import { ActionService } from "#server/features/chat/services/ActionService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";

const user = {
	id: CommonUtils.getRandomId(),
	name: "Branch test",
	settings: {},
	isEphemeral: true,
};
const content = {
	author: "USER" as const,
	config: zConfig.parse({ provider: "test", model: "test" }),
	data: [],
	metadata: [],
};
beforeAll(async () => {
	await db.orm.public.User.create({
		...user,
		email: `${user.id}@branch.test`,
		emailVerified: false,
		image: null,
		updatedAt: Temporal.Now.plainDateTimeISO("UTC"),
		isAnonymous: true,
		cache: { providers: [] },
	});
});
afterAll(async () => {
	await db.orm.public.User.where({ id: user.id }).delete();
});

describe("MessageService", () => {
	it("retains original branches, clones all descendants, paginates selected branches and deletes safely", async () => {
		const root = await MessageService.createMessage({ user, ...content });
		const a = await MessageService.createMessage({
			user,
			...content,
			author: "MODEL",
			chat: root.chatId,
			previous: root.id,
		});
		const b = await MessageService.createMessage({
			user,
			...content,
			author: "MODEL",
			chat: root.chatId,
			previous: root.id,
		});
		const leaf = await MessageService.createMessage({
			user,
			...content,
			chat: root.chatId,
			previous: b.id,
		});
		const edited = await MessageService.editMessage({
			user,
			...content,
			message: root.id,
			truncate: false,
		});
		const original = await MessageService.getMessages({
			user,
			chat: root.chatId,
		});
		expect(original.messages.map((m) => m.id)).toEqual([root.id, a.id]);
		const cloned = await MessageService.getMessages({
			user,
			chat: root.chatId,
			start: edited.id,
		});
		expect(cloned.messages[0].id).toBe(edited.id);
		expect(cloned.branchOptions[cloned.messages[1].id]).toHaveLength(2);
		const secondClone = cloned.branchOptions[cloned.messages[1].id][1];
		const clonedLong = await MessageService.getMessages({
			user,
			chat: root.chatId,
			start: secondClone,
		});
		expect(clonedLong.messages).toHaveLength(3);
		expect(clonedLong.messages.at(-1)?.id).not.toBe(leaf.id);
		const page = await MessageService.getMessages({
			user,
			chat: root.chatId,
			branches: { [root.id]: b.id },
			limit: 1,
		});
		expect(page.messages.map((m) => m.id)).toEqual([leaf.id]);
		const earlier = await MessageService.getMessages({
			user,
			chat: root.chatId,
			branches: { [root.id]: b.id },
			cursor: page.nextCursor ?? undefined,
			limit: 1,
		});
		expect(earlier.messages.map((m) => m.id)).toEqual([b.id]);
		const truncated = await MessageService.editMessage({
			user,
			...content,
			message: root.id,
			truncate: true,
		});
		expect(
			(
				await MessageService.getMessages({
					user,
					chat: root.chatId,
					start: truncated.id,
				})
			).messages,
		).toHaveLength(1);
		await MessageService.deleteMessage({ user, message: a.id });
		expect(
			(await MessageService.getMessage({ user, message: root.id })).id,
		).toBe(root.id);
		expect(
			(await MessageService.getMessage({ user, message: b.id })).previousId,
		).toBe(root.id);
		await expect(
			MessageService.createMessage({
				user: { ...user, id: "not-owner" },
				...content,
				chat: root.chatId,
				previous: root.id,
			}),
		).rejects.toThrow();
	});
	it("keeps branch order during generation and actions anchored to the original message", async () => {
		const root = await MessageService.createMessage({ user, ...content });
		const a = await MessageService.createMessage({
			user,
			...content,
			chat: root.chatId,
			previous: root.id,
		});
		const b = await MessageService.createMessage({
			user,
			...content,
			chat: root.chatId,
			previous: root.id,
		});
		const action = await ActionService.createAction({
			user,
			message: b,
			schedule: "FREQ=DAILY",
			timezone: "UTC",
			data: [],
		});
		const edited = await MessageService.editMessage({
			user,
			...content,
			message: b,
			truncate: true,
		});
		expect(
			(await ActionService.getActions({ user })).find(
				(item) => item.id === action.id,
			)?.messageId,
		).toBe(b.id);
		const updated = await MessageService.updateMessage({
			user,
			...content,
			message: a,
			data: [[{ id: "text", type: "text", value: "Generated" }]],
		});
		expect(updated.createdAt).toEqual(a.createdAt);
		expect(
			(
				await MessageService.getMessages({ user, chat: root.chatId })
			).messages.at(-1)?.id,
		).toBe(a.id);
		const source = await MessageService.getMessages({
			user,
			chat: root.chatId,
			start: action.messageId,
		});
		expect(source.messages.map((m) => m.id)).toEqual([root.id, b.id]);
		expect(source.messages.map((m) => m.id)).not.toContain(edited.id);
		await ActionService.deleteAction({ user, id: action.id });
	});

	it("locates a message on a branch other than the default one", async () => {
		const root = await MessageService.createMessage({ user, ...content });
		const a = await MessageService.createMessage({
			user,
			...content,
			author: "MODEL",
			chat: root.chatId,
			previous: root.id,
		});
		const b = await MessageService.createMessage({
			user,
			...content,
			author: "MODEL",
			chat: root.chatId,
			previous: root.id,
		});
		const leaf = await MessageService.createMessage({
			user,
			...content,
			chat: root.chatId,
			previous: b.id,
		});
		const located = await MessageService.locateMessage({
			user,
			message: leaf.id,
		});
		expect(located).toEqual({
			chatId: root.chatId,
			branches: { "": root.id, [root.id]: b.id, [b.id]: leaf.id },
		});
		const path = await MessageService.getMessages({
			user,
			chat: root.chatId,
			branches: located.branches,
		});
		expect(path.messages.map((m) => m.id)).toEqual([root.id, b.id, leaf.id]);
		const fallback = await MessageService.getMessages({
			user,
			chat: root.chatId,
		});
		expect(fallback.messages.map((m) => m.id)).toEqual([root.id, a.id]);
	});
});
