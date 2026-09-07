import { testUser } from "../../../tests.ts";
import { SettingsService } from "./SettingsService.ts";

const user = testUser();

describe("SettingsService", () => {
	it("rejects invalid settings", async () => {
		await expect(
			SettingsService.setSettings({
				user,
				update: () => ({ embeddingConfig: "invalid" }) as never,
			}),
		).rejects.toThrow();
	});

	it("accepts valid settings", async () => {
		await expect(
			SettingsService.setSettings({
				user,
				update: () => ({ useBrowserModels: false }),
			}),
		).resolves.not.toThrow();
	});
});
