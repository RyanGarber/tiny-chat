import type { AuthService as BackendAuthService } from "@tiny-chat/backend/src/core/services/AuthService.ts";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { KeyringService } from "./KeyringService.ts";

export const AuthService = createAuthClient({
	baseURL: process.env.DEV
		? `http://localhost:${process.env.VITE_BACKEND_PORT}`
		: process.env.VITE_BACKEND_URL,
	basePath: process.env.VITE_BACKEND_PATH_AUTH,
	fetchOptions: {
		auth: {
			type: "Bearer",
			token: () => KeyringService.getSessionToken() ?? undefined,
		},
	},
	plugins: [
		anonymousClient(),
		inferAdditionalFields<typeof BackendAuthService>(),
	],
});
