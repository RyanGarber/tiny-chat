import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { db } from "../../../db.ts";
import { testUser } from "../../../tests.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { DreamRunnerService } from "./DreamRunnerService.ts";

const user = testUser();
const content = {
	author: "USER" as const,
	config: zConfig.parse({ provider: "test", model: "test-generate" }),
	data: [
		[
			{
				id: CommonUtils.getRandomId(),
				type: "text" as const,
				value: "orchids greenhouse",
			},
		],
	],
	metadata: [],
};

describe("DreamRunnerService", () => {
	it("dreams pending eligible messages", async () => {
		const old = Temporal.Now.plainDateTimeISO("UTC").subtract({ days: 2 });
		const message = await MessageService.createMessage({
			user,
			...content,
			data: [[{ ...content.data[0][0], value: "orchid ".repeat(3000) }]],
		});
		const hidden = await MessageService.createMessage({
			user,
			...content,
			incognito: true,
		});
		const temporary = await MessageService.createMessage({
			user,
			...content,
			temporary: true,
		});
		await db.orm.public.Message.where((m) =>
			m.id.in([message.id, hidden.id, temporary.id]),
		).updateAll({ createdAt: old });
		await db.orm.public.User.where({ id: user.id }).update({
			settings: { dreamConfig: content.config },
		});
		await DreamRunnerService.next({ testUserId: user.id });
		const links = await db.orm.public.DreamMessage.where({
			messageId: message.id,
		}).all();
		expect(links).toHaveLength(1);
		expect(
			await db.orm.public.Dream.where({ userId: user.id }).select("id").all(),
		).toHaveLength(1);
		expect(
			await db.orm.public.DreamMessage.where({ messageId: hidden.id }).all(),
		).toEqual([]);
		expect(
			await db.orm.public.DreamMessage.where({ messageId: temporary.id }).all(),
		).toEqual([]);
		await DreamRunnerService.next({ testUserId: user.id });
		expect(
			await db.orm.public.Dream.where({ userId: user.id }).select("id").all(),
		).toHaveLength(1);

		const failed = await MessageService.createMessage({ user, ...content });
		await db.orm.public.Message.where({ id: failed.id }).update({
			createdAt: old,
		});
		await db.orm.public.User.where({ id: user.id }).update({
			settings: { dreamConfig: { ...content.config, provider: "nonexistent" } },
		});
		await DreamRunnerService.next({ testUserId: user.id });
		expect(
			await db.orm.public.DreamMessage.where({ messageId: failed.id }).all(),
		).toEqual([]);
	});
});
