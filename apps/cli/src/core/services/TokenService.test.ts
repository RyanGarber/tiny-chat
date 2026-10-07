import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { KeyringService } from "#cli/core/services/KeyringService.ts";
import { TokenService } from "#cli/core/services/TokenService.ts";
import { StorageService } from "./StorageService.ts";

const temp = mkdtempSync(join(tmpdir(), "tiny-chat-token-test-"));
beforeAll(() => {
	StorageService.setOverride(join(temp, ".tiny-chat.json"));
});
afterAll(() => {
	StorageService.setOverride(null);
	rmSync(temp, { recursive: true, force: true });
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
		TokenService.keyring(false);
		expect(TokenService.get()).toBeFalsy();
		TokenService.set("test-token");
		expect(JSON.parse(readFileSync(StorageService.path(), "utf-8")).token).toBe(
			"test-token",
		);
		expect(TokenService.get()).toBe("test-token");
		TokenService.set(null);
		expect(TokenService.get()).toBeFalsy();
		expect(get).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	} finally {
		get.mockRestore();
		set.mockRestore();
	}
});
