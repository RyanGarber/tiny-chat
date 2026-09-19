import type { zAttachmentPart } from "@tiny-chat/core/src/features/data/types/part.ts";
import { useAtomStore } from "../stores/useAtomStore.ts";
import {
	type EditorPart,
	useEditorPartStore,
} from "../stores/useEditorPartStore.ts";
import { AtomUtils } from "./AtomUtils.ts";
import { PASTE_LINE_LIMIT } from "./PasteUtils.ts";

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

	it("writes every atom back out as the pointer it stands for", () => {
		const file = attachment("src/index.ts", { id: "file" });
		const pasted = paste("pasted");

		expect(
			AtomUtils.serialize({ content: `look at ${file} and ${pasted}` }),
		).toBe('look at :attachment[]{id="file"} and \n::paste{id="pasted"}\n');
	});

	it("takes the pointers of a message back into atoms", () => {
		useEditorPartStore.getState().setParts([
			{
				id: "file",
				type: "attachment",
				source: "src/index.ts",
				label: "index.ts",
				content: { type: "file", mime: "", data: "" },
			},
			{ id: "cmd", type: "command", name: "model", argument: "opus" },
		]);

		const markdown = 'run :command[]{id="cmd"} on :attachment[]{id="file"}';
		const content = AtomUtils.deserialize(markdown);

		expect(content).toBe("run /model opus on @index.ts");
		expect(AtomUtils.serialize({ content })).toBe(markdown);
	});

	it("takes an upload's name back out of its attachment pointer", () => {
		useEditorPartStore.getState().setParts([
			{
				id: "upload",
				type: "attachment",
				source: "/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa",
				label: "notes.pdf",
				content: { type: "directory", items: [] },
			},
		]);
		expect(AtomUtils.deserialize('see :attachment[]{id="upload"}')).toBe(
			"see @notes.pdf/",
		);
	});

	it("leaves a pointer with nothing behind it as it was written", () => {
		expect(AtomUtils.deserialize('see :attachment[]{id="gone"}')).toBe(
			'see :attachment[]{id="gone"}',
		);
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
