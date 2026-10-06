import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { ApiContext } from "#server/core/utils/ApiContext.ts";
import { ApiRouter } from "#server/core/utils/ApiRouter.ts";

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
