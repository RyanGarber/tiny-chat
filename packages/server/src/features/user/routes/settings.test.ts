import { testClient } from "../../../tests.ts";

const { api } = testClient();

describe("settings", () => {
	it("returns settings without parsing", async () => {
		expect(await api.settings.getRaw.query()).toBeTypeOf("object");
	});
});
