import { useAtomStore } from "#client/features/editor/stores/useAtomStore.ts";
import {
	type EditorPart,
	useEditorPartStore,
} from "#client/features/editor/stores/useEditorPartStore.ts";
import { AtomUtils } from "#client/features/editor/utils/AtomUtils.ts";
import { PASTE_LINE_LIMIT } from "#client/features/editor/utils/PasteUtils.ts";
import type { zAttachmentPart } from "#core/features/data/types/part.ts";

let next = 0;

/** Register a part and report the atom standing for it. */
const stand = (part: EditorPart) => {
	useEditorPartStore.getState().addPart(part);
	return AtomUtils.fromPart({ part });
};

const attachment = (source: string, rest: Partial<zAttachmentPart> = {}) =>
	stand({
		id: `part-${next++}`,
		type: "attachment",
		source,
		label: "",
		content: { type: "file", mime: "", data: "" },
		...rest,
	});

const longPaste = Array.from(
	{ length: PASTE_LINE_LIMIT },
	(_, index) => `line ${index}`,
).join("\n");

const paste = (id = `part-${next++}`) =>
	stand({
		id,
		type: "paste",
		text: longPaste,
		lines: PASTE_LINE_LIMIT,
		language: null,
		collapsed: true,
	});

describe("AtomUtils", () => {
	beforeEach(() => {
		next = 0;
		useAtomStore.getState().setAtoms([]);
		useEditorPartStore.getState().setParts([]);
	});

	it("stands an attachment as its name alone", () => {
		expect(attachment("src/features/Editor.tsx")).toBe("@Editor.tsx");
	});

	it("tells two files of the same name apart by their path", () => {
		expect(attachment("src/a/index.ts")).toBe("@index.ts");
		expect(attachment("src/b/index.ts")).toBe("@b/index.ts");
	});

	it("gives the same part the same atom", () => {
		expect(attachment("src/a/index.ts", { id: "one" })).toBe(
			attachment("src/a/index.ts", { id: "one" }),
		);
		expect(useAtomStore.getState().atoms).toHaveLength(1);
	});

	it("stands an upload as its name rather than its id", () => {
		expect(
			attachment("/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa", {
				label: "tiny-chat @ main",
				content: { type: "directory", items: [] },
			}),
		).toBe("@tiny-chat @ main/");
	});

	it("stands a command as it was typed", () => {
		expect(
			stand({ id: "cmd", type: "command", name: "model", argument: "opus" }),
		).toBe("/model opus");
	});

	it("stands a paste as the lines it spans", () => {
		expect(paste()).toBe(`[${PASTE_LINE_LIMIT} pasted lines]`);
	});

	it("cuts the buffer into its text and the parts its atoms stand for", () => {
		const file = attachment("src/index.ts", { id: "file" });
		const pasted = paste("pasted");

		expect(
			AtomUtils.toData({ content: `look at ${file} and\n${pasted}` }).map(
				(part) => (part.type === "text" ? part.value : part.id),
			),
		).toEqual(["look at ", "file", " and\n", "pasted"]);
	});

	it("writes a message back out as a buffer of atoms", () => {
		const parts = [
			{ id: "t1", type: "text" as const, value: "run " },
			{ id: "cmd", type: "command" as const, name: "model", argument: "opus" },
			{ id: "t2", type: "text" as const, value: " on " },
			{
				id: "file",
				type: "attachment" as const,
				source: "src/index.ts",
				label: "index.ts",
				content: { type: "file" as const, mime: "", data: "" },
			},
		];

		const content = AtomUtils.fromData([parts]);
		expect(content).toBe("run /model opus on @index.ts");
		expect(
			AtomUtils.toData({ content }).map((part) =>
				part.type === "text" ? part.value : part.id,
			),
		).toEqual(["run ", "cmd", " on ", "file"]);
	});

	it("stands an upload as its name rather than its id", () => {
		expect(
			AtomUtils.fromData([
				[
					{ id: "t", type: "text", value: "see " },
					{
						id: "upload",
						type: "attachment",
						source: "/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa",
						label: "notes.pdf",
						content: { type: "directory", items: [] },
					},
				],
			]),
		).toBe("see @notes.pdf/");
	});

	it("leaves an atom whose part has gone as the text it stood as", () => {
		const file = attachment("src/index.ts", { id: "file" });
		useEditorPartStore.getState().setParts([]);

		expect(AtomUtils.toData({ content: `see ${file}` })).toMatchObject([
			{ type: "text", value: "see @index.ts" },
		]);
	});

	it("drops the atoms the buffer no longer holds", () => {
		const file = attachment("src/index.ts");
		AtomUtils.fromPart({
			content: file,
			part: {
				id: "pasted",
				type: "paste",
				text: longPaste,
				lines: PASTE_LINE_LIMIT,
				collapsed: true,
			},
		});

		expect(useAtomStore.getState().atoms.map((atom) => atom.kind)).toEqual([
			"attachment",
			"paste",
		]);

		attachment("src/other.ts");

		expect(useAtomStore.getState().atoms.map((atom) => atom.kind)).toEqual([
			"attachment",
			"paste",
			"attachment",
		]);

		// The buffer has been emptied since, so nothing stands in it any more.
		AtomUtils.fromPart({
			content: "",
			part: {
				id: "last",
				type: "attachment",
				source: "src/last.ts",
				label: "",
				content: { type: "file", mime: "", data: "" },
			},
		});

		expect(useAtomStore.getState().atoms.map((atom) => atom.text)).toEqual([
			"@last.ts",
		]);
	});

	it("blanks the atoms out without moving anything around them", () => {
		const file = attachment("src/index.ts");
		const content = `see ${file} now`;
		const masked = AtomUtils.mask({
			content,
			atoms: useAtomStore.getState().atoms,
		});

		expect(masked).toHaveLength(content.length);
		expect(masked).toBe(`see ${" ".repeat(file.length)} now`);
	});

	it("reports where each atom stands", () => {
		const file = attachment("src/index.ts");

		expect(
			AtomUtils.tokens({
				content: `a ${file} b`,
				atoms: useAtomStore.getState().atoms,
			}),
		).toEqual([
			expect.objectContaining({
				kind: "attachment",
				text: file,
				start: 2,
				end: 2 + file.length,
			}),
		]);
	});
});
