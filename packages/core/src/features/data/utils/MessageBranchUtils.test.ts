import { MessageBranchUtils } from "./MessageBranchUtils.ts";

const m = (id: string, previousId: string | null, time = 0) => ({
	id,
	previousId,
	createdAt: new Date(time),
});
const tree = [
	m("r", null),
	m("a", "r"),
	m("b", "r", 1),
	m("a0", "a"),
	m("a1", "a", 1),
	m("b0", "b"),
	m("other", null, 1),
];
const ids = (rows: typeof tree) => rows.map((m) => m.id);
describe("MessageBranchUtils", () => {
	it("defaults every fork to branch 0, independently of query order", () => {
		expect(ids(MessageBranchUtils.getBranch([...tree].reverse()))).toEqual([
			"r",
			"a",
			"a0",
		]);
	});
	it("selects roots and nested branches, falling back for deleted selections", () => {
		expect(
			ids(MessageBranchUtils.getBranch(tree, undefined, { r: "b" })),
		).toEqual(["r", "b", "b0"]);
		expect(
			ids(MessageBranchUtils.getBranch(tree, undefined, { a: "a1" })),
		).toEqual(["r", "a", "a1"]);
		expect(
			ids(MessageBranchUtils.getBranch(tree, undefined, { "": "other" })),
		).toEqual(["other"]);
		expect(
			ids(MessageBranchUtils.getBranch(tree, undefined, { r: "deleted" })),
		).toEqual(["r", "a", "a0"]);
	});
	it("reconstructs the ancestors of any anchor then defaults its continuation", () => {
		expect(ids(MessageBranchUtils.getBranch(tree, "b"))).toEqual([
			"r",
			"b",
			"b0",
		]);
		expect(ids(MessageBranchUtils.getBranch(tree, "a1"))).toEqual([
			"r",
			"a",
			"a1",
		]);
	});
	it("finds the full subtree without sibling branches", () => {
		expect(ids(MessageBranchUtils.getDescendants(tree, "a"))).toEqual([
			"a0",
			"a1",
		]);
	});
	it("handles empty chats and rejects missing anchors and cycles", () => {
		expect(MessageBranchUtils.getBranch([])).toEqual([]);
		expect(() => MessageBranchUtils.getBranch(tree, "missing")).toThrow();
		expect(() =>
			MessageBranchUtils.getBranch([m("x", "y"), m("y", "x")], "x"),
		).toThrow("cycle");
	});
});
