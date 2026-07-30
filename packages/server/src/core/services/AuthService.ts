import type { IncomingMessage } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { AuthServer } from "../AuthServer.ts";

export const AuthService = {
	handle: toNodeHandler(AuthServer),

	headers: (reqHeaders: IncomingMessage["headers"]) => {
		const headers = new Headers();
		for (const [key, value] of Object.entries(reqHeaders)) {
			if (Array.isArray(value)) {
				value.forEach((v) => {
					headers.append(key, v);
				});
			} else if (value) {
				headers.append(key, value);
			}
		}
		return headers;
	},
} as const;
