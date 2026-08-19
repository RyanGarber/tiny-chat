import { describe, expect, it } from "vitest";
import { FileExcludeUtils, type FileScope } from "./FileExcludeUtils.ts";

const category = (path: string, isDirectory = false) =>
	FileExcludeUtils.getCategory({ path, isDirectory });

const included = (path: string, scope: FileScope) =>
	FileExcludeUtils.include({ path, scope });

describe("FileExcludeUtils", () => {
	describe("categories", () => {
		it.each([
			["node_modules/left-pad/index.js", "dependency"],
			["src/__pycache__/app.cpython-312.pyc", "cache"],
			[".git/objects/ab/cdef", "vcs"],
			["dist/bundle.js", "build"],
			["pnpm-lock.yaml", "lockfile"],
			["assets/logo.png", "media"],
			["data/users.sqlite3", "data"],
			["downloads/app.tar.gz", "archive"],
			["native/app.dylib", "binary"],
			["public/app.min.js", "minified"],
			["api/schema.generated.ts", "generated"],
			["proto/user_pb2.py", "generated"],
			[".env.production", "secret"],
			["deploy/server.pem", "secret"],
			["photos/.DS_Store", "junk"],
			["docs/~$report.docx", "junk"],
		])("reads %s as %s", (path, expected) => {
			expect(category(path)).toBe(expected);
		});

		it.each([
			"src/app.ts",
			"README.md",
			"Dockerfile",
			"src/main.rs",
			".gitignore",
			"config/settings.yaml",
			"notes/2024-01-01.log",
			"data/report.csv",
		])("leaves %s alone", (path) => {
			expect(category(path)).toBeNull();
		});

		// `.ts` is a video container as well as a language, and guessing wrong
		// here would hide most of a TypeScript project from every search.
		it("does not mistake TypeScript for a transport stream", () => {
			expect(category("src/index.ts")).toBeNull();
			expect(category("src/index.tsx")).toBeNull();
		});

		// A committed template documents configuration rather than holding any.
		it("keeps environment templates while excluding the real thing", () => {
			expect(category(".env")).toBe("secret");
			expect(category(".env.local")).toBe("secret");
			expect(category(".env.example")).toBeNull();
			expect(category(".env.sample")).toBeNull();
		});

		// `build`, `bin` and `out` are all plausible names for a script.
		it("only reads ordinary names as directories when they are one", () => {
			expect(category("scripts/build", true)).toBe("build");
			expect(category("scripts/build", false)).toBeNull();
			expect(category("build/index.js")).toBe("build");
		});

		// Every segment before the last is a directory whatever the caller said.
		it("judges an interior segment as a directory regardless", () => {
			expect(category("build/nested/app.js", false)).toBe("build");
		});

		// Without a root, `Library` on the way to the project condemns
		// everything below it — which is exactly what `root` is for.
		it("ignores everything above the root it was given", () => {
			expect(
				FileExcludeUtils.getCategory({
					path: "/Users/me/Library/work/src/app.ts",
					root: "/Users/me/Library/work",
				}),
			).toBeNull();

			expect(
				FileExcludeUtils.getCategory({
					path: "/Users/me/Library/work/src/app.ts",
				}),
			).toBe("build");
		});

		it("matches names the same way whatever the separator or case", () => {
			expect(category("src\\Node_Modules\\dep\\index.js")).toBe("dependency");
			expect(category("Assets/Logo.PNG")).toBe("media");
		});
	});

	describe("scopes", () => {
		it("withholds nothing from a caller that named the path", () => {
			for (const path of [".git/config", "logo.png", "node_modules/dep.js"]) {
				expect(included(path, "all")).toBe(true);
			}
		});

		// The reason the scopes exist: an upload of screenshots and logs has to
		// survive a listing, and has no business in a text search.
		it("lists what was uploaded but does not search it", () => {
			for (const path of ["screenshot.png", "run.log", "archive.zip"]) {
				expect(included(path, "listing")).toBe(true);
			}
			expect(included("screenshot.png", "search")).toBe(false);
			expect(included("archive.zip", "search")).toBe(false);
			// Logs are text, and grepping them is a real thing to want.
			expect(included("run.log", "search")).toBe(true);
		});

		it("withholds only the certainly-unwanted from a listing", () => {
			for (const path of [
				".git/config",
				"node_modules/dep/index.js",
				"__pycache__/app.pyc",
				".DS_Store",
			]) {
				expect(included(path, "listing")).toBe(false);
			}

			// Build output is a plausible thing to send on purpose.
			for (const path of ["dist/app.js", "coverage/index.html"]) {
				expect(included(path, "listing")).toBe(true);
				expect(included(path, "search")).toBe(false);
			}
		});

		it("keeps credentials out of a search but not out of a listing", () => {
			expect(included(".env", "listing")).toBe(true);
			expect(included(".env", "search")).toBe(false);
		});
	});

	describe("getSkipReason", () => {
		const encode = (text: string) => new TextEncoder().encode(text);

		it("reports the category that turned a file away", () => {
			expect(
				FileExcludeUtils.getSkipReason({
					path: "assets/logo.png",
					data: encode("not really a png"),
				}),
			).toEqual({ reason: "media" });
		});

		it("reads a file the scope allows", () => {
			expect(
				FileExcludeUtils.getSkipReason({
					path: "src/app.ts",
					data: encode("const a = 1;"),
				}),
			).toEqual({ reason: null, text: "const a = 1;" });
		});

		it("still applies size and content checks to an allowed path", () => {
			expect(
				FileExcludeUtils.getSkipReason({
					path: "src/app.ts",
					data: encode("x".repeat(FileExcludeUtils.maxFileBytes + 1)),
				}),
			).toEqual({ reason: "large" });

			expect(
				FileExcludeUtils.getSkipReason({
					path: "src/app.ts",
					data: new Uint8Array([110, 0, 1, 2, 3]),
				}),
			).toEqual({ reason: "binary" });
		});

		// An upload converts a document to text and keeps its extension, so the
		// name cannot decide this one and the bytes have to.
		it("searches a document that turned out to be text", () => {
			expect(
				FileExcludeUtils.getSkipReason({
					path: "docs/handbook.pdf",
					data: encode("# Handbook\n\nThe converted text."),
				}),
			).toMatchObject({ reason: null });

			expect(
				FileExcludeUtils.getSkipReason({
					path: "docs/handbook.pdf",
					data: new Uint8Array([37, 80, 68, 70, 0, 1, 2]),
				}),
			).toEqual({ reason: "binary" });
		});

		it("has a phrase for every reason it can give", () => {
			expect(FileExcludeUtils.reasons.media).toBeTruthy();
			expect(FileExcludeUtils.reasons.large).toBeTruthy();
		});
	});
});
