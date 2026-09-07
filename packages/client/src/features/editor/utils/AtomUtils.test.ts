import { useMarkdownDataStore } from "../../message/stores/useMarkdownDataStore.ts";
import { useAtomStore } from "../stores/useAtomStore.ts";
import { AtomUtils } from "./AtomUtils.ts";
import { PASTE_LINE_LIMIT, PasteUtils } from "./PasteUtils.ts";

const attachment = (source: string) =>
	AtomUtils.attachment({
		id: source,
		source,
		markdown: `:attachment[]{id="${source}"}`,
	});

const longPaste = Array.from(
	{ length: PASTE_LINE_LIMIT },
	(_, index) => `line ${index}`,
).join("\n");

describe("AtomUtils", () => {
	beforeEach(() => {
		useAtomStore.getState().setAtoms([]);
		useMarkdownDataStore.getState().setAttachments([]);
	});

	it("stands an attachment as its name alone", () => {
		expect(attachment("src/features/Editor.tsx")).toBe("@Editor.tsx");
	});

	it("tells two files of the same name apart by their path", () => {
		expect(attachment("src/a/index.ts")).toBe("@index.ts");
		expect(attachment("src/b/index.ts")).toBe("@b/index.ts");
	});

	it("gives the same Markdown the same atom", () => {
		expect(attachment("src/a/index.ts")).toBe(attachment("src/a/index.ts"));
		expect(useAtomStore.getState().atoms).toHaveLength(1);
	});

	it("stands an upload as its name rather than its id", () => {
		expect(
			AtomUtils.attachment({
				id: "upload",
				source: "/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa",
				directory: true,
				label: "tiny-chat @ main",
				markdown: "",
			}),
		).toBe("@tiny-chat @ main/");
	});

	it("takes an upload's name back out of its attachment id", () => {
		useMarkdownDataStore.getState().addAttachment({
			id: "upload",
			type: "attachment",
			source: "/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa",
			label: "notes.pdf",
			content: { type: "directory", items: [] },
		});
		expect(AtomUtils.deserialize('see :attachment[]{id="upload"}')).toBe(
			"see @notes.pdf/",
		);
	});

	it("stands a command as it was typed", () => {
		expect(
			AtomUtils.command({
				name: "model",
				value: "opus",
				markdown: ':command[opus]{name="model" value="model"}',
			}),
		).toBe("/model opus");
	});

	it("leaves a short paste alone and collapses a long one", () => {
		expect(AtomUtils.paste({ text: "one\ntwo\nthree" })).toBeNull();
		expect(AtomUtils.paste({ text: longPaste })).toBe(
			`[${PASTE_LINE_LIMIT} pasted lines]`,
		);
	});

	it("writes every atom back out as its Markdown", () => {
		const file = attachment("src/index.ts");
		const pasted = AtomUtils.paste({ text: longPaste });

		expect(
			AtomUtils.serialize({ content: `look at ${file} and ${pasted}` }),
		).toBe(
			`look at :attachment[]{id="src/index.ts"} and \n${PasteUtils.markdown(longPaste)}\n`,
		);
	});

	it("takes the directives of a message back into atoms", () => {
		useMarkdownDataStore.getState().addAttachment({
			id: "file",
			type: "attachment",
			source: "src/index.ts",
			label: "index.ts",
			content: { type: "file", mime: "", data: "" },
		});
		const markdown =
			'run :command[opus]{name="model" value="model"} on ' +
			':attachment[]{id="file"}';

		const content = AtomUtils.deserialize(markdown);

		expect(content).toBe("run /model opus on @index.ts");
		expect(AtomUtils.serialize({ content })).toBe(markdown);
	});

	it("takes a paste directive back into an atom", () => {
		const markdown = PasteUtils.markdown(longPaste);
		const content = AtomUtils.deserialize(`see\n${markdown}`);

		expect(content).toBe(`see\n[${PASTE_LINE_LIMIT} pasted lines]`);
		expect(AtomUtils.serialize({ content })).toBe(`see\n\n${markdown}\n`);
	});

	it("drops the atoms the buffer no longer holds", () => {
		const file = attachment("src/index.ts");
		AtomUtils.paste({ content: file, text: longPaste });

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
		AtomUtils.attachment({
			content: "",
			id: "last",
			source: "src/last.ts",
			markdown: ':attachment[]{id="last"}',
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
