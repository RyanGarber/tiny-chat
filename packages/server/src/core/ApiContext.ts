import type { IncomingMessage, ServerResponse } from "node:http";
import { TRPCError } from "@trpc/server";
import { AuthServer } from "./AuthServer.ts";
import { AuthService } from "./services/AuthService.ts";

export const ApiContext = async ({
	req,
	res,
}: {
	req: IncomingMessage;
	res: ServerResponse;
}) => {
	const session = await AuthServer.api.getSession({
		headers: AuthService.headers(req.headers),
	});
	if (!session?.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: `Not authenticated.`,
		});
	}
	return { req, res, session };
};

export type ApiContext = Awaited<ReturnType<typeof ApiContext>>;
