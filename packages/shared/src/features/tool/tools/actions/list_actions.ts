import { z } from "zod";
import type { UserContextCapability } from "../../../capability/types/capability.ts";
import { zData } from "../../../data/types/message.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({});

const output = z.array(
	z.object({
		id: z.cuid2(),
		chat_id: z.cuid2(),
		prompt: z.string(),
		created_at: z.date(),
	}),
);

export const list_actions: Tool<
	typeof input,
	void,
	typeof output,
	{ userContext: UserContextCapability }
> = {
	name: "list_actions",
	description: "List all scheduled actions.",

	input,
	output,

	execute: async ({ capabilities }) => {
		const actions = await capabilities.userContext.getActions();
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
};
