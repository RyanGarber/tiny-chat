import { describe, expect, it } from "vitest";
import { FileEditUtils } from "./FileEditUtils.ts";

describe("FileEditUtils", () => {
	it("replaces an exact match", () => {
		const result = FileEditUtils.apply({
			content: "const a = 1;\nconst b = 2;\n",
			old_string: "const b = 2;",
			new_string: "const b = 3;",
		});
		expect(result.strategy).toEqual("exact");
		expect(result.replacements).toEqual(1);
		expect(result.content).toEqual("const a = 1;\nconst b = 3;\n");
	});

	it("refuses an ambiguous match unless replace_all is set", () => {
		const content = "a();\nb();\na();\n";

		expect(() =>
			FileEditUtils.apply({
				content,
				old_string: "a();",
				new_string: "c();",
			}),
		).toThrow(/Found 2 matches/);

		expect(
			FileEditUtils.apply({
				content,
				old_string: "a();",
				new_string: "c();",
				replace_all: true,
			}),
		).toMatchObject({ replacements: 2, content: "c();\nb();\nc();\n" });
	});

	it("matches lines that differ only in surrounding whitespace", () => {
		const result = FileEditUtils.apply({
			content:
				"const f = () => {\n    if (x) {\n        return 1;\n    }\n};\n",
			old_string: "if (x) {\n    return 1;\n}",
			new_string: "if (y) {\n    return 2;\n}",
		});
		expect(result.strategy).toEqual("trimmed");
		expect(result.content).toEqual(
			"const f = () => {\n    if (y) {\n        return 2;\n    }\n};\n",
		);
	});

	it("matches lines that differ in internal whitespace", () => {
		const result = FileEditUtils.apply({
			content: "const  x   =  1;\n",
			old_string: "const x = 1;",
			new_string: "const x = 2;",
		});
		expect(result.strategy).toEqual("whitespace");
		expect(result.content).toEqual("const x = 2;\n");
	});

	it("anchors a block on its first and last line", () => {
		const result = FileEditUtils.apply({
			content: "function a() {\n\t// current comment\n\treturn 1;\n}\n",
			old_string: "function a() {\n\t// stale comment\n\treturn 1;\n}",
			new_string: "function a() {\n\treturn 2;\n}",
		});
		expect(result.strategy).toEqual("anchor");
		expect(result.content).toEqual("function a() {\n\treturn 2;\n}\n");
	});

	it("keeps the trailing line break when old_string has one", () => {
		const result = FileEditUtils.apply({
			content: "a\nb\nc\n",
			old_string: "b\n",
			new_string: "",
		});
		expect(result.content).toEqual("a\nc\n");
	});

	it("keeps the line endings the file already uses", () => {
		const result = FileEditUtils.apply({
			content: "a\r\nb\r\nc\r\n",
			old_string: "b",
			new_string: "b1\nb2",
		});
		expect(result.content).toEqual("a\r\nb1\r\nb2\r\nc\r\n");
	});

	it("rejects edits it cannot apply", () => {
		expect(() =>
			FileEditUtils.apply({
				content: "a\n",
				old_string: "z",
				new_string: "y",
			}),
		).toThrow(/not found/);

		expect(() =>
			FileEditUtils.apply({
				content: "a\n",
				old_string: "a",
				new_string: "a",
			}),
		).toThrow(/exactly the same/);

		expect(() =>
			FileEditUtils.apply({
				content: "a\n",
				old_string: "",
				new_string: "b",
			}),
		).toThrow(/empty/);
	});
});
