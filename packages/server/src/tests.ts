/// <reference types="../../../vitest.context.d.ts" />

import "./db.ts";

import { inferPrismaClient } from "@ryangarber/better-auth-adapter-prisma/client";
import type { userFields } from "@tiny-chat/core/prisma/better-auth-adapter.ts";
import { JsonService } from "@tiny-chat/core/src/core/services/JsonService.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createAuthClient } from "better-auth/client";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { beforeAll, inject } from "vitest";
import type { ApiRouter } from "./core/utils/ApiRouter.ts";
import type { AuthServer } from "./core/utils/AuthServer.ts";

const nextId = () => crypto.getRandomValues(new Uint8Array(24)).join("");

/**
 * Creates a temporary test user and returns it.
 * Best for simple server tests.
 */
export function testUser(overrides: Partial<zUser> = {}): zUser {
	const user: zUser = {
		id: CommonUtils.getRandomId(),
		name: "Test User",
		settings: {},
		...overrides,
		isEphemeral: true,
	};

	beforeAll(async () => {
		await globalThis.db.orm.public.User.create({
			...user,
			email: `${user.id}@test.com`,
			emailVerified: false,
			image: null,
			updatedAt: Temporal.Now.plainDateTimeISO("UTC"),
			isAnonymous: true,
			cache: { providers: [] },
		});
	});

	afterAll(async () => {
		// TODO - confirm that these relations are cascading and remove

		const dreams = await globalThis.db.orm.public.Dream.where({
			userId: user.id,
		})
			.select("id")
			.all();
		for (const dream of dreams) {
			await globalThis.db.orm.public.DreamMessage.where({
				dreamId: dream.id,
			}).deleteAll();
		}

		const chats = await globalThis.db.orm.public.Chat.where({ userId: user.id })
			.select("id")
			.all();
		for (const chat of chats) {
			await globalThis.db.orm.public.ChatMemory.where({
				chatId: chat.id,
			}).deleteAll();
		}

		await globalThis.db.orm.public.User.where({ id: user.id }).delete();
	});

	return user;
}

/**
 * Crates a temporary user and session and returns an authenticated API client.
 * Best for more complicated, real-world integration tests.
 */
export function testClient(user = testUser()) {
	const session = {
		id: nextId(),
		userId: user.id,
		token: nextId(),
		updatedAt: Temporal.Now.plainDateTimeISO("UTC"),
		expiresAt: Temporal.Now.plainDateTimeISO("UTC").add({ hours: 1 }),
	};

	beforeAll(async () => {
		await globalThis.db.orm.public.Session.create(session);
	});

	const authPlugins = [
		anonymousClient(),
		inferAdditionalFields<typeof AuthServer>(),
	];

	return {
		user,
		session,
		api: createTRPCClient<ApiRouter>({
			links: [
				httpLink({
					url: `${inject("serverUrl")}${CommonUtils.endpoints.api}/`,
					transformer: JsonService.transformer,
					headers: () => ({ Authorization: `Bearer ${session.token}` }),
					methodOverride: "POST",
				}),
			],
		}),
		auth: inferPrismaClient<typeof userFields>()(
			createAuthClient({
				baseURL: inject("serverUrl"),
				basePath: CommonUtils.endpoints.auth,
				fetchOptions: {
					auth: {
						type: "Bearer",
						token: () => session.token,
					},
				},
				plugins: authPlugins,
			}),
		),
	};
}
