import "./env.ts";

import { JsonService } from "@tiny-chat/core/src/core/services/JsonService.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { TestProvider } from "@tiny-chat/core/src/features/provider/providers/model/TestProvider.ts";
import { createTRPCClient, httpLink } from "@trpc/client";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { inject } from "vitest";
import type { TestProject } from "vitest/node";
import waitOn from "wait-on";
import type { ApiRouter } from "./core/utils/ApiRouter.ts";
import type { AuthServer } from "./core/utils/AuthServer.ts";

declare module "vitest" {
	export interface ProvidedContext {
		server_serverUrl: string;
		server_token: string;
		server_user: zUser;
		server_config: zConfig;
	}
}

export async function setup(project: TestProject) {
	console.log(`[tests] waiting for backend`);
	const backendUrl = `http://localhost:${process.env.VITE_SERVER_PORT}`;
	await waitOn({ resources: [backendUrl], timeout: 30000 });

	console.log(`[tests] creating test user`);
	const { auth } = testClient(backendUrl, null);
	const session = await auth.signIn.anonymous();
	if (session.error)
		throw new Error(`Failed to create session: ${session.error.message}`);
	const update = await auth.updateUser({
		isEphemeral: true,
		fetchOptions: {
			headers: { Authorization: `Bearer ${session.data.token}` },
		},
	});
	if (update.error)
		throw new Error(`Failed to update session: ${update.error.message}`);

	const user = zUser.parse({ ...session.data.user, isEphemeral: true });

	console.log(`[tests] setting up test user with token:`, session.data.token);
	const { models } = await TestProvider.getStatus({ user });
	const model = models.find((m) => m.features.includes("language"));
	if (!model) throw new Error("Failed to get test model");
	const config = zConfig.parse({
		provider: TestProvider.name,
		model: model.name,
		args: model.args.map((arg) => ({
			name: arg.name,
			value: arg.default,
		})),
	});

	console.log("[tests] test user ready", user);
	project.provide("server_serverUrl", backendUrl);
	project.provide("server_token", session.data.token);
	project.provide("server_user", user);
	project.provide("server_config", config);

	return async () => {
		console.log("[tests] cleaning up test user");
		const deletion = await auth.deleteAnonymousUser({
			fetchOptions: {
				headers: { Authorization: `Bearer ${session.data.token}` },
			},
		});
		if (deletion.error)
			throw new Error(`Failed to delete session: ${deletion.error.message}`);
	};
}

export function testClient(
	backendUrl = inject("server_serverUrl"),
	token: string | null = inject("server_token"),
) {
	return {
		api: createTRPCClient<ApiRouter>({
			links: [
				httpLink({
					url: `${backendUrl}${CommonUtils.endpoints.api}/`,
					transformer: JsonService.transformer,
					headers: () => ({ Authorization: `Bearer ${token}` }),
					methodOverride: "POST",
				}),
			],
		}),
		auth: createAuthClient({
			baseURL: backendUrl,
			basePath: CommonUtils.endpoints.auth,
			fetchOptions: {
				auth: {
					type: "Bearer",
					token: () => token ?? undefined,
				},
			},
			plugins: [anonymousClient(), inferAdditionalFields<typeof AuthServer>()],
		}),
	};
}
