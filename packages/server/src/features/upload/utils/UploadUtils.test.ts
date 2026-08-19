import { beforeAll, describe, expect, it } from "vitest";
import { testClient } from "../../../tests.ts";
import { UploadUtils } from "./UploadUtils.ts";

/**
 * Postgres `!~*` is a case-insensitive POSIX match. For the plain alternation,
 * anchors and escaped literals this builder emits, that is the same language a
 * JavaScript regular expression speaks, so the clauses can be checked here
 * without a database.
 */
const keepBySql = ({ path, extras }: { path: string; extras?: boolean }) => {
	const { values } = UploadUtils.shouldIncludeFileSql({ extras });
	return !(values as string[]).some((source) =>
		new RegExp(source, "i").test(path),
	);
};

describe("UploadUtils", () => {
	describe("shouldIncludeFile", () => {
		it.each([
			"src/app.ts",
			"README.md",
			"Dockerfile",
			"docs/handbook.pdf",
			"logs/run.log",
			"data/report.csv",
		])("stores %s", (path) => {
			expect(UploadUtils.shouldIncludeFile({ path })).toBe(true);
		});

		it.each([
			"node_modules/dep/index.js",
			".git/config",
			"assets/logo.png",
			"pnpm-lock.yaml",
			"dist/app.js",
			".env",
		])("leaves out %s", (path) => {
			expect(UploadUtils.shouldIncludeFile({ path })).toBe(false);
		});

		// A zip the user assembled by hand is taken as sent, apart from the
		// debris the archiver added on the way.
		it("only drops OS debris without extras", () => {
			expect(
				UploadUtils.shouldIncludeFile({
					path: "__MACOSX/._logo.png",
					extras: false,
				}),
			).toBe(false);

			for (const path of ["assets/logo.png", "dist/app.js", ".env"]) {
				expect(UploadUtils.shouldIncludeFile({ path, extras: false })).toBe(
					true,
				);
			}
		});

		it("accepts a path in either shape", () => {
			expect(
				UploadUtils.shouldIncludeFile({ path: ["node_modules", "dep.js"] }),
			).toBe(false);
		});
	});

	describe("shouldIncludeFileSql", () => {
		it.each([
			["src/app.ts", true],
			["src/index.ts", true],
			["deep/nested/path/file.ts", true],
			["docs/handbook.pdf", true],
			["logs/run.log", true],
			["node_modules/dep/index.js", false],
			["assets/logo.png", false],
			["Assets/LOGO.PNG", false],
			[".git/config", false],
			["pnpm-lock.yaml", false],
			["dist/app.js", false],
		])("agrees with shouldIncludeFile about %s", (path, expected) => {
			expect(keepBySql({ path })).toBe(expected);
			expect(UploadUtils.shouldIncludeFile({ path })).toBe(expected);
		});

		// `_` is a single-character wildcard in `LIKE`, which is why this is
		// written as a regular expression instead.
		it("does not treat an underscore as a wildcard", () => {
			expect(keepBySql({ path: "nodeXmodules/dep/index.js" })).toBe(true);
		});

		// Every row is a file, so a directory-only name needs its slash.
		it("keeps a file that shares a name with a build directory", () => {
			expect(keepBySql({ path: "scripts/build" })).toBe(true);
			expect(keepBySql({ path: "build/app.js" })).toBe(false);
		});

		it("keeps credentials out of the embedding queue", () => {
			expect(keepBySql({ path: ".env" })).toBe(false);
			expect(keepBySql({ path: ".env.local" })).toBe(false);
		});

		it("still drops debris when extras are off", () => {
			expect(keepBySql({ path: "photos/.DS_Store", extras: false })).toBe(
				false,
			);
			expect(keepBySql({ path: "assets/logo.png", extras: false })).toBe(true);
		});
	});
});

describe("utils - files", () => {
	const { api } = testClient();

	beforeAll(async () => {
		const data = new FormData();
		data.set("type", "ATTACHMENT");
		data.set(
			"file",
			new File(["This should not be embedded."], "package-lock.json"),
		);
		await api.upload.createUpload.mutate(data);
		data.set("file", new File(["But this should."], "question.md"));
		await api.upload.createUpload.mutate(data);
	});

	it("includes the correct files", async () => {
		const missingEmbeddings = await api.embedding.getMissingEmbeddings.query(
			{},
		);
		expect(
			missingEmbeddings?.files.find(
				(file) => file.text === "This should not be embedded.",
			),
		).toBeUndefined();
		expect(
			missingEmbeddings?.files.find((file) => file.text === "But this should."),
		).toBeDefined();
	});
});
