import { ChatService } from "#server/features/chat/services/ChatService.ts";
import { testUser } from "#server/tests.ts";

const folder = (path: string) => ({ path, whitelist: true });
const user = testUser({ settings: { folders: [folder("/user")] } });

describe("ChatService.getWorkingDirectory", () => {
	it("activates the project's first folder over the user's", async () => {
		const project = await ChatService.createProject({ user, title: "P" });
		await globalThis.db.orm.public.Project.where({ id: project.id }).update({
			settings: { folders: [folder("/first"), folder("/second")] },
		});

		const selected = await ChatService.getWorkingDirectory({
			user,
			project: project.id,
		});
		expect(selected.cwd).toBe("/first");
		expect(selected.folders.map((f) => f.path)).toEqual([
			"/user",
			"/first",
			"/second",
		]);
	});

	it("falls back to the user's first folder without project folders", async () => {
		const project = await ChatService.createProject({ user, title: "Empty" });
		expect(
			(await ChatService.getWorkingDirectory({ user, project: project.id }))
				.cwd,
		).toBe("/user");
		expect((await ChatService.getWorkingDirectory({ user })).cwd).toBe("/user");
	});
});
