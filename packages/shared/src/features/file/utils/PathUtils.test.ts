import { describe, expect, it } from "vitest";
import { PathUtils } from "./PathUtils.ts";

describe("PathUtils", () => {
	it("builds mount paths", () => {
		expect(PathUtils.toMount({ path: ["file.txt"] })).toEqual(
			"/mnt/chat/file.txt",
		);
		expect(PathUtils.toMount({ uploadId: "id" })).toEqual("/mnt/chat/id");
		expect(PathUtils.toMount({ uploadId: "id", path: [""] })).toEqual(
			"/mnt/chat/id",
		);
		expect(
			PathUtils.toMount({
				uploadId: "id",
				path: "src\\\\index.ts",
			}),
		).toEqual("/mnt/chat/id/src/index.ts");
	});

	it("parses mount paths", () => {
		expect(PathUtils.fromMount({ path: "/file.txt" })).toBeNull();
		expect(PathUtils.fromMount({ path: "/mnt/chat" })).toEqual({
			uploadId: undefined,
			path: [],
		});
		expect(PathUtils.fromMount({ path: "/mnt/chat/file" })).toEqual({
			uploadId: undefined,
			path: ["file"],
		});
		expect(
			PathUtils.fromMount({ path: "/mnt/chat/zzzzzzzzzzzzzzzzzzzzzzzz" }),
		).toEqual({
			uploadId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			path: [],
		});
		expect(
			PathUtils.fromMount({
				path: "/mnt/chat/zzzzzzzzzzzzzzzzzzzzzzzz/src/index.ts",
			}),
		).toEqual({
			uploadId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			path: ["src", "index.ts"],
		});
	});

	it("checks descendents of paths", () => {
		expect(
			PathUtils.contains({
				parent: "/src/",
				descendent: ["", "src", "generated", "index.ts", ""],
			}),
		).toBe(true);
		expect(
			PathUtils.contains({
				parent: ["src", "generated"],
				descendent: "/src/generated",
			}),
		).toBe(false);
		expect(
			PathUtils.contains({
				parent: ["src", "generated"],
				descendent: "/src/generated/index.ts",
			}),
		).toBe(true);
		expect(
			PathUtils.contains({ parent: ["src", "index.ts"], descendent: ["lib"] }),
		).toBe(false);
	});

	it("checks direct children of paths", () => {
		expect(
			PathUtils.contains({
				parent: "/src",
				child: ["", "src", "", "index.ts"],
			}),
		).toBe(true);
		expect(
			PathUtils.contains({
				parent: "/src",
				child: ["", "src", "generated", "index.ts"],
			}),
		).toBe(false);
		expect(
			PathUtils.contains({
				parent: ["", "src", "", "generated"],
				child: "//src//generated//index.ts",
			}),
		).toBe(true);
		expect(PathUtils.contains({ parent: [], child: ["README.md"] })).toBe(true);
	});
});
