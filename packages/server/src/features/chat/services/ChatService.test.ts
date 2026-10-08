import { ChatService } from "#server/features/chat/services/ChatService.ts";
import { testUser } from "#server/tests.ts";

const folder = (path: string) => ({ path, whitelist: true });
const user = testUser({ settings: { folders: [folder("/user")] } });

describe("ChatService.getWorkingDirectory", () => {
	it("offers the project's folders before the user's", async () => {
		const project = await ChatService.createProject({ user, title: "P" });
		await globalThis.db.orm.public.Project.where({ id: project.id }).update({
			settings: { folders: [folder("/first"), folder("/second")] },
		});

		const selected = await ChatService.getWorkingDirectory({
			user,
			project: project.id,
		});
		expect(selected.candidates).toEqual(["/first", "/second", "/user"]);
		expect(selected.projectCandidates).toEqual(["/first", "/second"]);
		expect(selected.folders.map((f) => f.path)).toEqual([
			"/user",
			"/first",
			"/second",
		]);
	});

	it("offers only the user's folders without project folders", async () => {
		const project = await ChatService.createProject({ user, title: "Empty" });
		expect(
			(await ChatService.getWorkingDirectory({ user, project: project.id }))
				.candidates,
		).toEqual(["/user"]);
		expect(
			(await ChatService.getWorkingDirectory({ user })).candidates,
		).toEqual(["/user"]);
	});
});
