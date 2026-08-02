import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous, bearer } from "better-auth/plugins";
import { internalIpV4 } from "internal-ip";
import { prisma } from "../db.ts";

export const AuthServer = betterAuth({
	baseURL: process.argv.includes("--dev")
		? `http://${process.argv.includes("--host") ? await internalIpV4() : "localhost"}:${process.env.VITE_SERVER_PORT}`
		: process.env.VITE_SERVER_URL,
	basePath: CommonUtils.endpoints.auth,
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	user: {
		deleteUser: {
			enabled: true,
		},
		additionalFields: {
			settings: {
				type: "string" as unknown as "json",
				required: true,
				defaultValue: {},
			},
			isEphemeral: {
				type: "boolean",
				required: true,
				defaultValue: false,
			},
		},
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
				// cache is not in better auth, so it needs to be transferred manually
				const caches = await globalThis.prisma.user.findMany({
					where: { id: { in: [anonymousUser.user.id, newUser.user.id] } },
					select: { id: true, cache: true },
				});
				const cache = caches.reduce(
					(acc, user) => {
						acc[user.id] = user.cache;
						return acc;
					},
					{} as Record<string, any>,
				);
				const updates = await globalThis.prisma.$transaction([
					globalThis.prisma.user.update({
						where: { id: newUser.user.id },
						data: {
							settings: {
								...anonymousUser.user.settings,
								...newUser.user.settings,
							},
							cache: {
								...cache[anonymousUser.user.id],
								...cache[newUser.user.id],
							},
						},
					}),
					globalThis.prisma.folder.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.chat.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.message.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.action.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.memory.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.upload.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
					globalThis.prisma.file.updateMany({
						where: { userId: anonymousUser.user.id },
						data: { userId: newUser.user.id },
					}),
				]);
				console.log("[AuthService] transferred user records:", updates);
			},
		}),
		bearer(),
		{
			id: "token-storage",
			onResponse: async (ctx) => {
				const token = ctx.headers.get("set-auth-token");
				const location = ctx.headers.get("location");
				if (token && location) {
					const url = new URL(location);
					url.hash = url.hash
						? `${url.hash}&token=${token}`
						: `#token=${token}`;
					ctx.headers.set("location", url.toString());
					console.log("[AuthService] redirecting:", url.toString());
				}
				await new Promise<void>((r) => r());
			},
		},
	],
});
