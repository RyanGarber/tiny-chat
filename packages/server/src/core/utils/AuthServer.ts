import { prisma8Adapter } from "@ryangarber/better-auth-adapter-prisma";
import { userFields } from "@tiny-chat/core/prisma/better-auth-adapter.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { betterAuth } from "better-auth";
import { anonymous, bearer } from "better-auth/plugins";
import { internalIpV4 } from "internal-ip";
import { db } from "../../db.ts";

export const AuthServer = userFields.inferClient(
	betterAuth({
		baseURL: process.argv.includes("--dev")
			? `http://${process.argv.includes("--host") ? await internalIpV4() : "localhost"}:${process.env.VITE_SERVER_PORT}`
			: process.env.VITE_SERVER_URL,
		basePath: CommonUtils.endpoints.auth,
		database: prisma8Adapter(db),
		user: {
			deleteUser: {
				enabled: true,
			},
			additionalFields: userFields.additionalFields,
		},
		trustedOrigins: [
			`http://${process.argv.includes("--host") ? await internalIpV4() : "localhost"}:${process.env.VITE_WEB_PORT}`,
			process.env.VITE_WEB_URL as string,
		],
		socialProviders: {
			github: {
				clientId: process.env.AUTH_GITHUB_CLIENT as string,
				clientSecret: process.env.AUTH_GITHUB_SECRET,
			},
			google: {
				clientId: process.env.AUTH_GOOGLE_CLIENT as string,
				clientSecret: process.env.AUTH_GOOGLE_SECRET,
			},
			huggingface: {
				clientId: process.env.AUTH_HUGGINGFACE_CLIENT as string,
				clientSecret: process.env.AUTH_HUGGINGFACE_SECRET,
			},
		},
		plugins: [
			anonymous({
				generateName: () => CommonUtils.getRandomName(),
				onLinkAccount: async ({ anonymousUser, newUser }) => {
					const updates = globalThis.db.transaction(async (tx) => {
						// merge user fields that better auth may not know about
						// (made gross thanks to prisma's new readonly return types)
						const fields = ["settings", "cache"] as const;

						const anonymousFields = (await tx.orm.public.User.where({
							id: anonymousUser.user.id,
						})
							.select(...fields)
							.first()) as Record<
							(typeof fields)[number],
							object | null
						> | null;

						const newFields = (await tx.orm.public.User.where({
							id: newUser.user.id,
						})
							.select(...fields)
							.first()) as Record<
							(typeof fields)[number],
							object | null
						> | null;

						await tx.orm.public.User.where({
							id: newUser.user.id,
						}).updateAndCount(
							Object.fromEntries(
								fields.map((field) => [
									field,
									{ ...anonymousFields?.[field], ...newFields?.[field] },
								]),
							),
						);

						// merge all other user tables
						await db.orm.public.Folder.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Chat.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Message.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Action.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Memory.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Upload.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.File.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Subagent.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });

						await db.orm.public.Dream.where({
							userId: anonymousUser.user.id,
						}).updateAndCount({ userId: newUser.user.id });
					});

					console.log("[AuthService] transferred user records:", updates);
				},
			}),
			bearer(),
			{
				id: "token-storage",
				async onResponse(res) {
					const token = res.headers.get("set-auth-token");
					const location = res.headers.get("location");
					if (token && location) {
						const url = new URL(location);
						url.hash = url.hash
							? `${url.hash}&token=${token}`
							: `#token=${token}`;
						res.headers.set("location", url.toString());
						console.log("[AuthService] redirecting:", url.toString());
					}
					await new Promise<void>((r) => r());
				},
			},
		],
	} satisfies Parameters<typeof betterAuth>[0]),
);
