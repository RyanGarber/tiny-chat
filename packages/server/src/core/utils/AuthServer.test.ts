import { testClient } from "../../tests.ts";

describe("AuthServer", () => {
	const { auth, user, api } = testClient();
	let clientUser: (typeof auth)["$Infer"]["Session"]["user"] | undefined;

	beforeAll(async () => {
		const fetchedUser = await auth.getSession();
		if (fetchedUser.data?.user) {
			clientUser = fetchedUser.data.user;
		}
	});

	it("gets a valid, authenticated test user", async () => {
		expect.assert(clientUser !== undefined);
		expect(clientUser.id).toEqual(user.id);
		await expect(api.settings.get.query()).resolves.not.toThrow();
	});
});
