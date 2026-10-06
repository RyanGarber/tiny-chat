import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KeyringService } from "#cli/core/services/KeyringService.ts";

// Stable across CLI runs, but separate between users on shared temp directories.
const PATH = join(
	tmpdir(),
	`tiny-chat-${process.getuid?.() ?? "user"}-session-token`,
);

let noKeyring = false;

export const TokenService = {
	path: PATH,
	enableTempFile: () => {
		noKeyring = true;
	},

	get: () => {
		if (!noKeyring) return KeyringService.getSessionToken();
		try {
			return readFileSync(TokenService.path, "utf-8") || null;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
	},
	set: (token: string | null | undefined) => {
		if (!noKeyring) return KeyringService.setSessionToken(token ?? "");
		if (!token) {
			rmSync(TokenService.path, { force: true });
			return;
		}
		writeFileSync(TokenService.path, token, { encoding: "utf-8", mode: 0o600 });
	},
} as const;
