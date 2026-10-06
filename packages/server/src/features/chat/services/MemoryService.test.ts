import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { zConfig } from "#core/features/data/types/message.ts";
import { db } from "#server/db.ts";
import { MemoryService } from "#server/features/chat/services/MemoryService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";

const user = {
	id: CommonUtils.getRandomId(),
	name: "Memory test",
	settings: {},
	isEphemeral: true,
};
const content = {
	author: "USER" as const,
	config: zConfig.parse({ provider: "test", model: "test" }),
	data: [],
	metadata: [],
};
const memory = (messageId: string | null) => ({
	id: CommonUtils.getRandomId(),
	userId: user.id,
	config: null,
	fact: "Likes tea",
	category: "PREFERENCES" as const,
	stability: "LONG_TERM" as const,
	evidence: ["said so"],
	confidence: 0.9,
	messageId,
});
beforeAll(async () => {
	await db.orm.public.User.create({
		...user,
		email: `${user.id}@memory.test`,
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

describe("MemoryService", () => {
	it("lists memories learned from or retrieved into a chat", async () => {
		const message = await MessageService.createMessage({ user, ...content });
		const other = await MessageService.createMessage({ user, ...content });
		const learned = await db.orm.public.Memory.create(memory(message.id));
		const retrieved = await db.orm.public.Memory.create(memory(other.id));
		await db.orm.public.Memory.create(memory(null));
		await db.orm.public.MessageContext.create({
			messageId: message.id,
			memoryId: retrieved.id,
		});
		const ids = await MemoryService.getChatMemoryIds({
			user,
			chat: message.chatId,
		});
		expect(ids.sort()).toEqual([learned.id, retrieved.id].sort());
		expect(
			await MemoryService.getChatMemoryIds({ user, chat: other.chatId }),
		).toEqual([retrieved.id]);
	});
});
