import { ActiveChatUtils } from "#client/features/chat/utils/ActiveChatUtils.ts";

const project = { id: "p", title: "Project" };

describe("ActiveChatUtils", () => {
	it("keeps options only while the chat is new", () => {
		const fresh = ActiveChatUtils.setOptions(ActiveChatUtils.start(project), {
			temporary: true,
		});
		expect(ActiveChatUtils.options(fresh)).toEqual({
			temporary: true,
			incognito: false,
		});

		const open = ActiveChatUtils.open(fresh, "a");
		expect(open).toMatchObject({ status: "open", chatId: "a", project });
		expect(ActiveChatUtils.options(open)).toEqual({
			temporary: false,
			incognito: false,
		});
		expect(ActiveChatUtils.setOptions(open, { incognito: true })).toBe(open);
	});

	it("drops branches and focus on leaving a chat, but not on reopening it", () => {
		let active = ActiveChatUtils.open(ActiveChatUtils.start(null), "a");
		active = ActiveChatUtils.selectBranch(active, null, "m1");
		active = ActiveChatUtils.focus(active, "m2", {
			...ActiveChatUtils.branches(active),
		});
		expect(ActiveChatUtils.open(active, "a")).toBe(active);
		expect(ActiveChatUtils.branches(active)).toEqual({ "": "m1" });
		expect(ActiveChatUtils.branches(active, "b")).toEqual({});

		const other = ActiveChatUtils.open(active, "b");
		expect(other).toMatchObject({ branches: {}, focusedMessage: null });
		expect(
			ActiveChatUtils.selectBranch(ActiveChatUtils.start(null), null, "m"),
		).toEqual(ActiveChatUtils.start(null));
	});

	it("follows the open chat into its project once it loads", () => {
		const active = ActiveChatUtils.open(ActiveChatUtils.start(project), "a");
		const loaded = { id: "a", projectId: "q", project: { title: "Other" } };
		expect(ActiveChatUtils.load(active, loaded).project).toEqual({
			id: "q",
			title: "Other",
		});
		expect(
			ActiveChatUtils.load(active, { id: "a", projectId: null }).project,
		).toBeNull();
		// Another chat's data, or the same placement, leaves it alone.
		expect(ActiveChatUtils.load(active, { ...loaded, id: "b" })).toBe(active);
		expect(
			ActiveChatUtils.load(active, {
				id: "a",
				projectId: "p",
				project: { title: "Project" },
			}),
		).toBe(active);
	});
});
