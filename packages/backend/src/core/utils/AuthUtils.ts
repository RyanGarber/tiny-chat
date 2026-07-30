import type { IncomingMessage } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { AuthService } from "../services/AuthService.ts";

export const AuthUtils = {
	handle: toNodeHandler(AuthService),

	getHeaders: (reqHeaders: IncomingMessage["headers"]) => {
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
