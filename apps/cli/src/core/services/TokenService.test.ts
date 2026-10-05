import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test, vi } from "vitest";
import { KeyringService } from "./KeyringService.ts";
import { TokenService } from "./TokenService.ts";

const dir = mkdtempSync(join(tmpdir(), "tiny-chat-token-test-"));
const originalPath = TokenService.path;
Object.defineProperty(TokenService, "path", {
	value: join(dir, "token"),
	configurable: true,
});

afterAll(() => {
	Object.defineProperty(TokenService, "path", { value: originalPath });
	rmSync(dir, { recursive: true, force: true });
});

test("--no-keyring stores and clears a private plain-text temp token without calling the keyring", () => {
	const get = vi
		.spyOn(KeyringService, "getSessionToken")
		.mockImplementation(() => {
			throw new Error("keyring accessed");
		});
	const set = vi
		.spyOn(KeyringService, "setSessionToken")
		.mockImplementation(() => {
			throw new Error("keyring accessed");
		});
	try {
		TokenService.enableTempFile();
		expect(TokenService.get()).toBeNull();
		TokenService.set("test-token");
		expect(readFileSync(TokenService.path, "utf-8")).toBe("test-token");
		expect(TokenService.get()).toBe("test-token");
		if (process.platform !== "win32") {
			expect(statSync(TokenService.path).mode & 0o777).toBe(0o600);
		}
		TokenService.set(null);
		expect(TokenService.get()).toBeNull();
		expect(get).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	} finally {
		get.mockRestore();
		set.mockRestore();
	}
});
