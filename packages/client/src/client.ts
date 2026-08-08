import type { Transport } from "@modelcontextprotocol/client";
import { QueryClient } from "@tanstack/react-query";
import { zEnv, type zProviderEnv } from "@tiny-chat/core/src/core/types/env.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ShellCapability } from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { ModelProvider } from "@tiny-chat/core/src/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
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
import type { ClientInput } from "./features/chat/services/MessagingService.ts";

export interface ClientProviders {
	getModelProviders: (_: {
		client: Client;
		user: zUser;
	}) => Promise<ModelProvider<any>[]>;

	getProviderStates: (_: {
		client: Client;
		user: zUser;
		update?: boolean;
	}) => Promise<ProviderState<ProviderStatus>[]>;
}

export interface ClientTransports {
	createStdio?: (_: {
		name: string;
		command: string[];
		env?: Record<string, string>;
	}) => Transport;

	createStreamableHttp?: (_: {
		name: string;
		url: URL;
		headers?: Record<string, string>;
	}) => Transport;
}

export type ClientShell = ShellCapability;

export const createClient = ({
	env: _env,
	host = "localhost",
	getToken,
	setToken,
	getStorage,
	setStorage,
	providers,
	transports,
	input,
	shell,
	desktop,
}: {
	env: Record<string, string | undefined>;
	host?: string;
	getToken: () => string | null | undefined;
	setToken: (token: string | null | undefined) => void;
	getStorage: <T>(key: string) => T | null;
	setStorage: <T>(key: string, value: T) => void;
	providers?: ClientProviders;
	transports?: ClientTransports;
	input?: ClientInput;
	shell?: ClientShell;
	desktop?: boolean;
}) => {
	const env = zEnv.safeParse(_env);
	if (!env.success) {
		console.error(z.treeifyError(env.error));
		throw new Error("invalid environment");
	}

	const webUrl = CommonUtils.isTruthy(env.data.DEV)
		? `http://${host}:${env.data.VITE_WEB_PORT}`
		: env.data.VITE_WEB_URL;

	const serverUrl = CommonUtils.isTruthy(env.data.DEV)
		? `http://${host}:${env.data.VITE_SERVER_PORT}`
		: env.data.VITE_SERVER_URL;

	const auth = createAuthClient({
		baseURL: serverUrl,
		basePath: CommonUtils.endpoints.auth,
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
				url: `${serverUrl}${CommonUtils.endpoints.api}`,
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

	const providerEnv: zProviderEnv = {
		...env.data,
		PROVIDER_RELAY_URL: serverUrl,
	};

	return {
		webUrl,
		serverUrl,
		api,
		query,
		queryClient,
		auth,
		providerEnv,
		getToken,
		setToken,
		getStorage,
		setStorage,
		providers,
		transports,
		input,
		shell,
		desktop,
	};
};

export type Client = Awaited<ReturnType<typeof createClient>>;

export const ClientContext = createContext<Client>(null as any);
