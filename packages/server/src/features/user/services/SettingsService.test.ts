import { SettingsService } from "#server/features/user/services/SettingsService.ts";
import { testUser } from "#server/tests.ts";

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
