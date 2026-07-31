import { QueryClient } from "@tanstack/react-query";
import { zEnv } from "@tiny-chat/core/src/core/types/env.ts";
import type { ApiRouter } from "@tiny-chat/server/src/core/ApiRouter.ts";
import type { AuthServer } from "@tiny-chat/server/src/core/AuthServer.ts";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { createContext } from "react";
import superjson from "superjson";
import { z } from "zod";

export const createClient = ({
	env: _env,
	host = "localhost",
	getToken,
	setToken,
}: {
	env: Record<string, string | undefined>;
	host?: string;
	getToken: () => string | null | undefined;
	setToken: (token: string | null | undefined) => void;
}) => {
	const env = zEnv.safeParse(_env);
	if (!env.success) {
		console.error(z.treeifyError(env.error));
		throw new Error("invalid environment");
	}

	const webUrl = env.data.DEV
		? `http://${host}:${env.data.VITE_WEB_PORT}`
		: env.data.VITE_WEB_URL;

	const serverUrl = env.data.DEV
		? `http://${host}:${env.data.VITE_SERVER_PORT}`
		: env.data.VITE_SERVER_URL;

	const mcpUrl = `${serverUrl}${env.data.VITE_SERVER_PATH_MCP}`;

	const auth = createAuthClient({
		baseURL: serverUrl,
		basePath: env.data.VITE_SERVER_PATH_AUTH,
		fetchOptions: {
			auth: {
				type: "Bearer",
				token: () => getToken() ?? undefined,
			},
		},
		plugins: [anonymousClient(), inferAdditionalFields<typeof AuthServer>()],
	});

	const api = createTRPCClient<ApiRouter>({
		links: [
			httpLink({
				url: `${serverUrl}${env.data.VITE_SERVER_PATH_API}`,
				transformer: superjson,
				headers: () => {
					const token = getToken();
					return { Authorization: token ? `Bearer ${token}` : undefined };
				},
				methodOverride: "POST",
			}),
		],
	});

	const queryClient = new QueryClient();

	const query = createTRPCOptionsProxy({
		client: api,
		queryClient: queryClient,
	});

	const providerEnv: zEnv = {
		...env.data,
		VITE_SERVER_URL: serverUrl,
	};

	return {
		webUrl,
		serverUrl,
		mcpUrl,
		api,
		query,
		queryClient,
		auth,
		providerEnv,
		getToken,
		setToken,
	};
};

export type Client = Awaited<ReturnType<typeof createClient>>;

export const ClientProvider = createContext<Client>(null as any);
