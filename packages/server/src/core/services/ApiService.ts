import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { ApiContext } from "../utils/ApiContext.ts";
import { ApiRouter } from "../utils/ApiRouter.ts";

export const ApiService = {
	handle: createHTTPHandler({
		router: ApiRouter,
		basePath: `${CommonUtils.endpoints.api}/`,
		createContext: ApiContext,
		maxBodySize: 50 * 1024 * 1024,
		onError: ({ error }) => {
			console.error("api error:", error);
		},
		allowMethodOverride: true,
	}),
} as const;
