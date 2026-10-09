import type { Transport } from "@modelcontextprotocol/client";
import { inferPrismaClient } from "@ryangarber/better-auth-adapter-prisma/client";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { createContext } from "react";
import { z } from "zod";
import { ChatService } from "#client/features/chat/services/ChatService.ts";
import { WorkingDirectoryService } from "#client/features/chat/services/WorkingDirectoryService.ts";
import type { ClientInput } from "#client/features/editor/services/ComposerService.ts";
import {
	type HostShellPrimitives,
	HostShellService,
} from "#client/features/shell/services/HostShellService.ts";
import { JsonService } from "#core/core/services/JsonService.ts";
import { zEnv, type zProviderEnv } from "#core/core/types/env.ts";
import { CodeUtils, type CodeWorker } from "#core/core/utils/CodeUtils.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zUser } from "#core/features/data/types/user.ts";
import type { ModelProvider } from "#core/features/provider/types/model.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
import type { userFields } from "#core/prisma/better-auth-adapter.ts";
import type { ApiRouter } from "#server/core/utils/ApiRouter.ts";
import type { AuthServer } from "#server/core/utils/AuthServer.ts";

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
		/**
		 * Receives what the server writes to stderr, which is never passed
		 * through to the host's own: in a terminal it would tear the UI.
		 */
		onStderr?: (text: string) => void;
	}) => Transport;

	createStreamableHttp?: (_: {
		name: string;
		url: URL;
		headers?: Record<string, string>;
	}) => Transport;
}

export type ClientShell = HostShellPrimitives;

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
	shell: primitives,
	desktop,
	highlighter,
	queryClient = new QueryClient(),
}: {
	env: zEnv;
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
	/** Starts the runtime's bundle of `HighlightWorker.ts`, where Shiki runs. */
	highlighter?: () => CodeWorker;
	queryClient?: QueryClient;
}) => {
	const env = zEnv.safeParse(_env);
	if (!env.success) {
		console.error(z.treeifyError(env.error));
		throw new Error("invalid environment");
	}

	CodeUtils.setWorker(highlighter);

	const webUrl = CommonUtils.isTruthy(env.data.DEV)
		? `http://${host}:${env.data.VITE_WEB_PORT}`
		: env.data.VITE_WEB_URL;

	const serverUrl = CommonUtils.isTruthy(env.data.DEV)
		? `http://${host}:${env.data.VITE_SERVER_PORT}`
		: env.data.VITE_SERVER_URL;

	const auth = inferPrismaClient<typeof userFields>()(
		createAuthClient({
			baseURL: serverUrl,
			basePath: CommonUtils.endpoints.auth,
			fetchOptions: {
				auth: {
					type: "Bearer",
					token: () => getToken() ?? undefined,
				},
			},
			plugins: [anonymousClient(), inferAdditionalFields<typeof AuthServer>()],
		}),
	);

	const api = createTRPCClient<ApiRouter>({
		links: [
			httpLink({
				url: `${serverUrl}${CommonUtils.endpoints.api}`,
				transformer: JsonService.transformer,
				headers: () => {
					const token = getToken();
					return { Authorization: token ? `Bearer ${token}` : undefined };
				},
				methodOverride: "POST",
			}),
		],
	});

	const query = createTRPCOptionsProxy({
		client: api,
		queryClient: queryClient,
	});

	const providerEnv: zProviderEnv = {
		...env.data,
		PROVIDER_RELAY_URL: serverUrl,
	};

	const shell = primitives && HostShellService.create(primitives);

	const workingDirectory = WorkingDirectoryService.create({
		shell,
		activate: (selection) => api.chat.activate.mutate(selection),
	});

	const client = {
		workingDirectory,
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

	ChatService.watch({ client });

	return client;
};

export type Client = Awaited<ReturnType<typeof createClient>>;

export const ClientContext = createContext<Client>(null as any);
