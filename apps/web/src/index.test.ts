import { server } from "./server.ts";

describe("Fastify", () => {
	it("should have the static plugin registered", async () => {
		await new Promise<void>((resolve) => {
			server.fastify.ready(() => {
				resolve();
			});
		});
		expect(server.fastify.printPlugins()).toContain("@fastify/static");
	});
});
