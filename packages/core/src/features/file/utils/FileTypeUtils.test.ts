import { describe, expect, it } from "vitest";
import { FileTypeUtils } from "./FileTypeUtils.ts";

describe("FileTypeUtils", () => {
	it("detects common mime types from extensions", async () => {
		expect(await FileTypeUtils.getMime({ path: ["~", ".zshrc"] })).toEqual(
			"text/x-shellscript",
		);
		expect(FileTypeUtils.getMimeSync({ path: "src/App.tsx" })).toEqual(
			"text/typescript",
		);
	});

	it("chooses common extensions from mime types", async () => {
		expect(FileTypeUtils.getExtension({ mime: "text/x-shellscript" })).toEqual(
			"bash",
		);
		expect(
			FileTypeUtils.getExtension({
				path: "C:\\Users\\Name\\Desktop\\image.jpeg",
			}),
		).toEqual("jpg");
	});
});
