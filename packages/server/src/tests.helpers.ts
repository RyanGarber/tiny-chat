import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { afterAll, beforeAll, inject } from "vitest";
import { db } from "./db.ts";

// TODO WIP - tool use of prisma no longer routes through trpc
export function testAgentContext(
	overrides: Partial<zAgentContext> = {},
): zAgentContext {
	const user = inject("server_user");

	return {
		user: inject("server_user"),
		chat: {
			id: "zzzzzzzzzzzzzzzzzzzzzzzz",
			userId: user.id,
			folderId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			incognito: false,
			temporary: false,
		},
		messages: overrides.messages ?? [],
		timezone: "America/New_York",
		interactive: false,
		...overrides,
	};
}

export function testUser(overrides: Partial<zUser> = {}) {
	const user: zUser = {
		id: CommonUtils.getRandomId(),
		name: "Test User",
		settings: {},
		...overrides,
		isEphemeral: true,
	};

	beforeAll(async () => {
		await db.orm.public.User.create({
			...user,
			email: `${user.id}@test.com`,
			emailVerified: false,
			image: null,
			updatedAt: Temporal.Now.plainDateTimeISO("UTC"),
			isAnonymous: true,
			cache: {},
		});
	});

	afterAll(async () => {
		// TODO - confirm that these relations are cascading and remove

		const dreams = await db.orm.public.Dream.where({ userId: user.id })
			.select("id")
			.all();
		for (const dream of dreams) {
			await db.orm.public.DreamMessage.where({
				dreamId: dream.id,
			}).deleteAll();
		}

		const chats = await db.orm.public.Chat.where({ userId: user.id })
			.select("id")
			.all();
		for (const chat of chats) {
			await db.orm.public.ChatMemory.where({ chatId: chat.id }).deleteAll();
		}

		await db.orm.public.User.where({ id: user.id }).delete();
	});

	return user;
}
