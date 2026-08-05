import type { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { inject } from "vitest";

// TODO WIP - tool use of prisma no longer routes through trpc
export function testGenerationContext(
	overrides: Partial<zAgentContext> = {},
): zAgentContext {
	const user = inject("backend_user");
	return {
		user: inject("backend_user"),
		chat: {
			id: "zzzzzzzzzzzzzzzzzzzzzzzz",
			userId: user.id,
			folderId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			incognito: false,
		},
		messages: overrides.messages ?? [],
		timezone: "America/New_York",
		...overrides,
	};
}
