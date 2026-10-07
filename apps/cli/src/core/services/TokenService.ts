import { KeyringService } from "#cli/core/services/KeyringService.ts";
import { StorageService } from "./StorageService.ts";

// Stable across CLI runs, but separate between users on shared temp directories.
export const TokenService = {
	keyring: (value: boolean) => {
		if (!value && !StorageService.getOverride()) {
			console.log("keying disabled, switching to alternate storage");
			StorageService.setOverride(true);
		}
	},

	get: () => {
		if (StorageService.getOverride()) {
			return StorageService.get<string | null>("token");
		}
		return KeyringService.getSessionToken();
	},

	set: (token: string | null | undefined) => {
		if (StorageService.getOverride()) {
			StorageService.set("token", token ?? "");
			return;
		}
		return KeyringService.setSessionToken(token ?? "");
	},
} as const;
