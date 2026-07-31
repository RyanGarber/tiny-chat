import { createClient } from "@tiny-chat/react/src/client.ts";
import { KeyringService } from "./core/services/KeyringService.ts";

export const client = createClient({
	env: process.env,
	getToken: () => KeyringService.getSessionToken(),
	setToken: (token) => KeyringService.setSessionToken(token ?? ""),
});
