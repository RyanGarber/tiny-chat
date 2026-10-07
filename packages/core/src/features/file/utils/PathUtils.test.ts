import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

describe("PathUtils", () => {
	it("builds mount paths", () => {
		expect(PathUtils.toMount({ path: ["chat", "id", "file.txt"] })).toEqual(
			"/mnt/chat/id/file.txt",
		);
		expect(PathUtils.toMount({ mount: "uploads", id: "id" })).toEqual(
			"/mnt/uploads/id",
		);
		expect(
			PathUtils.toMount({ mount: "skills", id: "id", path: [""] }),
		).toEqual("/mnt/skills/id");
		expect(
			PathUtils.toMount({
				mount: "uploads",
				id: "id",
				path: "src\\\\index.ts",
			}),
		).toEqual("/mnt/uploads/id/src/index.ts");
	});

	it("parses mount paths", () => {
		expect(PathUtils.fromMount({ path: "/file.txt" })).toBeNull();
		expect(PathUtils.fromMount({ path: "/mnt" })).toEqual({
			path: [],
			mount: undefined,
			id: undefined,
			rest: [],
		});
		// A path that names no tree is on the mount but in none of it, which is
		// what the root itself looks like too.
		expect(PathUtils.fromMount({ path: "/mnt/file" })).toEqual({
			path: ["file"],
			mount: undefined,
			id: undefined,
			rest: [],
		});
		expect(PathUtils.fromMount({ path: "/mnt/uploads/abc" })).toEqual({
			path: ["uploads", "abc"],
			mount: "uploads",
			id: "abc",
			rest: [],
		});
		expect(
			PathUtils.fromMount({ path: "/mnt/skills/abc/src/index.ts" }),
		).toEqual({
			path: ["skills", "abc", "src", "index.ts"],
			mount: "skills",
			id: "abc",
			rest: ["src", "index.ts"],
		});
	});

	it("places only whole segments on the mount", () => {
		expect(PathUtils.fromMount({ path: "/mntdata/x" })).toBeNull();
		expect(PathUtils.fromMount({ path: "/mnt/" })?.path).toEqual([]);
	});

	it("tells the virtual filesystem from the machine's own /mnt", () => {
		expect(PathUtils.isMounted("/mnt")).toBe(true);
		expect(PathUtils.isMounted("/mnt/")).toBe(true);
		expect(PathUtils.isMounted("/mnt/chat/abc/notes.md")).toBe(true);
		expect(PathUtils.isMounted({ path: "/mnt/uploads/abc" })).toBe(true);
		expect(PathUtils.isMounted("/mnt/c/Users/me")).toBe(false);
		expect(PathUtils.isMounted("/mnt/data")).toBe(false);
		expect(PathUtils.isMounted("/home/me")).toBe(false);
		expect(PathUtils.isMounted("C:\\mnt\\chat")).toBe(false);
	});

	it("unwraps verbatim Windows paths", () => {
		expect(PathUtils.normalize({ path: "\\\\?\\C:\\work" })).toBe("C:\\work");
		expect(
			PathUtils.normalize({ path: "\\\\?\\UNC\\wsl.localhost\\Ubuntu\\home" }),
		).toBe("\\\\wsl.localhost\\Ubuntu\\home");
		expect(
			PathUtils.normalize({ path: "\\\\wsl$\\Ubuntu\\home", unix: true }),
		).toBe("//wsl$/Ubuntu/home");
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
