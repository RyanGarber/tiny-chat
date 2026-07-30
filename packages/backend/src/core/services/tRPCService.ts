import type { IncomingMessage, ServerResponse } from "node:http";
import { TRPCError } from "@trpc/server";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { tRPCRouter } from "../routes/index.ts";
import { AuthUtils } from "../utils/AuthUtils.ts";
import { AuthService } from "./AuthService.ts";

const tRPCContext = async ({
	req,
	res,
}: {
	req: IncomingMessage;
	res: ServerResponse;
}) => {
	const session = await AuthService.api.getSession({
		headers: AuthUtils.getHeaders(req.headers),
	});
	if (!session?.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: `Not authenticated.`,
		});
	}
	return { req, res, session };
};
export type tRPCContext = Awaited<ReturnType<typeof tRPCContext>>;

export const tRPCService = {
	handle: createHTTPHandler({
		router: tRPCRouter,
		basePath: `${process.env.VITE_BACKEND_PATH_TRPC}/`,
		createContext: tRPCContext,
		maxBodySize: 50 * 1024 * 1024,
		onError: ({ error }) => {
			console.error("tRPC Error:", error);
		},
		allowMethodOverride: true,
	}),
} as const;
