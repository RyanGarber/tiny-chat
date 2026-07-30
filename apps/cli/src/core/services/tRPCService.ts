import { QueryClient } from "@tanstack/react-query";
import type { tRPCRouter } from "@tiny-chat/backend/src/core/routes/index.ts";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { KeyringService } from "./KeyringService.ts";

export const tRPCService = createTRPCClient<tRPCRouter>({
	links: [
		httpLink({
			url: process.env.DEV
				? `http://localhost:${process.env.VITE_BACKEND_PORT}${process.env.VITE_BACKEND_PATH_TRPC}`
				: `${process.env.VITE_BACKEND_URL}${process.env.VITE_BACKEND_PATH_TRPC}`,
			transformer: superjson,
			headers: () => {
				const token = KeyringService.getSessionToken();
				return { Authorization: token ? `Bearer ${token}` : undefined };
			},
			methodOverride: "POST",
		}),
	],
});

export const tRPCQueryClient = new QueryClient();

export const tRPCQuery = createTRPCOptionsProxy({
	client: tRPCService,
	queryClient: tRPCQueryClient,
});
