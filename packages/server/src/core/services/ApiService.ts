import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { ApiContext } from "../ApiContext.ts";
import { ApiRouter } from "../ApiRouter.ts";

export const ApiService = {
	handle: createHTTPHandler({
		router: ApiRouter,
		basePath: `${process.env.VITE_SERVER_PATH_API}/`,
		createContext: ApiContext,
		maxBodySize: 50 * 1024 * 1024,
		onError: ({ error }) => {
			console.error("api error:", error);
		},
		allowMethodOverride: true,
	}),
} as const;
