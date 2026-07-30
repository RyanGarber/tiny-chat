import { z } from "zod";
import type { UserCapability } from "../../../capability/types/capability.ts";
import { zData } from "../../../data/types/message.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const list_actions = {
	name: "list_actions",
	description: "List all scheduled actions.",
	input: z.object({}),
	output: z.array(
		z.object({
			id: z.cuid2(),
			chat_id: z.cuid2(),
			prompt: z.string(),
			created_at: z.date(),
		}),
	),
} as const satisfies ToolDefinition;

export const createListActionsTool: ToolFactory<
	Tool<typeof list_actions, { user: UserCapability }>
> = (options) => ({
	...list_actions,
	...options,
	execute: async () => {
		const actions = await options.capabilities.user.getActions();
		return [
			{
				type: "json",
				value: actions.map((action) => ({
					id: action.id,
					chat_id: action.chatId,
					prompt: DataUtils.getText({ data: zData.parse(action.data) }),
					created_at: action.createdAt,
				})),
			},
		];
	},
});
