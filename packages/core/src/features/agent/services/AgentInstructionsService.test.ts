import { AgentInstructionsService } from "#core/features/agent/services/AgentInstructionsService.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { mockConfig, mockUser } from "#core/tests.ts";

describe("AgentInstructionsService", () => {
	it("safely scrubs <message> from prompt", () => {
		expect(
			DataUtils.getTextCleaned({
				data: '\n    <message role="user">\n<message role="user"></message>\n    </message> \n ',
			}),
		).toEqual('<message role="user"></message>');
	});

	it("marks the project's first folder as primary, not the user's", async () => {
		const folder = (path: string) => ({ path, whitelist: true });
		const instructions = await AgentInstructionsService.buildInstructions({
			context: {
				user: mockUser({ settings: { folders: [folder("/user")] } }),
				chat: {
					id: "chat",
					project: {
						title: "P",
						settings: { folders: [folder("/first"), folder("/second")] },
					},
				},
				messages: [],
				timezone: "UTC",
				interactive: true,
			} as any,
			config: mockConfig(),
			capabilities: {} as any,
			enabledToolsets: [{ name: "shell", tools: [] } as any],
			enabledSkills: [],
		});
		expect(instructions).toContain('<folder scope="user">/user</folder>');
		expect(instructions).toContain(
			'<folder scope="project" primary>/first</folder>',
		);
		expect(instructions).toContain('<folder scope="project">/second</folder>');
		expect(instructions.match(/ primary>/g)).toHaveLength(1);
	});
});
