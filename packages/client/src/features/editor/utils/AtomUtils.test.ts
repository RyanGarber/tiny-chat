import { beforeEach, describe, expect, it } from "vitest";
import { useAtomStore } from "../stores/useAtomStore.ts";
import { AtomUtils } from "./AtomUtils.ts";

const attachment = (source: string) =>
	AtomUtils.attachment({
		source,
		markdown: `:attachment[]{source="${source}" is-directory="false"}`,
	});

describe("AtomUtils", () => {
	beforeEach(() => {
		useAtomStore.getState().setAtoms([]);
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
				source: "/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa",
				directory: true,
				label: "tiny-chat @ main",
				markdown: "",
			}),
		).toBe("@tiny-chat @ main/");
	});

	it("takes an upload's name back out of its directive", () => {
		expect(
			AtomUtils.deserialize(
				'see :attachment[]{source="/mnt/chat/aaaaaaaaaaaaaaaaaaaaaaaa" is-directory="true" name="notes.pdf"}',
			),
		).toBe("see @notes.pdf/");
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
		expect(AtomUtils.paste({ text: "line\n".repeat(41).trimEnd() })).toBe(
			"[41 pasted lines]",
		);
	});

	it("writes every atom back out as its Markdown", () => {
		const file = attachment("src/index.ts");
		const pasted = AtomUtils.paste({ text: "a\nb\nc\nd\ne\nf" });

		expect(
			AtomUtils.serialize({ content: `look at ${file} and ${pasted}` }),
		).toBe(
			'look at :attachment[]{source="src/index.ts" is-directory="false"} and a\nb\nc\nd\ne\nf',
		);
	});

	it("takes the directives of a message back into atoms", () => {
		const markdown =
			'run :command[opus]{name="model" value="model"} on ' +
			':attachment[]{source="src/index.ts" is-directory="false"}';

		const content = AtomUtils.deserialize(markdown);

		expect(content).toBe("run /model opus on @index.ts");
		expect(AtomUtils.serialize({ content })).toBe(markdown);
	});

	it("drops the atoms the buffer no longer holds", () => {
		const file = attachment("src/index.ts");
		AtomUtils.paste({ content: file, text: "a\nb\nc\nd\ne\nf" });

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
			source: "src/last.ts",
			markdown: ':attachment[]{source="src/last.ts" is-directory="false"}',
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
