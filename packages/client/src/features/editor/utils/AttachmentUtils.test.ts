import type { AttachmentItem } from "../types/attachment.ts";
import { AttachmentUtils } from "./AttachmentUtils.ts";

describe("AttachmentUtils", () => {
	it("keeps escaped spaces inside an attachment query", () => {
		expect(AttachmentUtils.match("See @folder\\ with\\ spaces/file")).toEqual({
			text: "folder with spaces/file",
			from: 4,
			to: 30,
		});
	});

	it("does not absorb prose after an unescaped space", () => {
		expect(AttachmentUtils.match("See @folder and more")).toBeNull();
		expect(AttachmentUtils.match("See @folder")).toEqual({
			text: "folder",
			from: 4,
			to: 11,
		});
	});

	it("escapes spaces when continuing a path", () => {
		const item: AttachmentItem = {
			name: "My Folder",
			value: "/My Folder",
			directory: true,
		};

		expect(AttachmentUtils.continued({ query: "My", item })).toBe(
			"My\\ Folder/",
		);
	});

	it("ranks attachment matches within their group", () => {
		const groups = [
			{
				items: [
					{ name: "my notes old", value: "old" },
					{ name: "notes", value: "exact" },
					{ name: "notes archive", value: "prefix" },
				],
			},
		];

		expect(
			AttachmentUtils.filter({ groups, query: "notes" })[0].items.map(
				(item) => item.value,
			),
		).toEqual(["exact", "prefix", "old"]);
	});

	it("keeps a matched group as it is, but still only what can be walked into", () => {
		const groups = [
			{
				matched: true,
				items: [
					{ name: "tools.rs", value: "deep", traversable: true },
					{ name: "notes", value: "other", traversable: true },
					{ name: "upload", value: "flat" },
				],
			},
		];

		expect(
			AttachmentUtils.filter({ groups, query: "src/srctools" })[0].items.map(
				(item) => item.value,
			),
		).toEqual(["deep", "other"]);
	});
});
