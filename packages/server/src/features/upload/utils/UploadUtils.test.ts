import { FileFixtureUtils } from "@tiny-chat/core/src/features/file/utils/FileFixtureUtils.ts";
import { testClient } from "../../../tests.ts";
import { UploadUtils } from "./UploadUtils.ts";

const { api } = testClient();

beforeAll(async () => {
	const data = new FormData();
	data.set("kind", "ATTACHMENT");
	data.set(
		"file",
		new File(["This should not be embedded."], "package-lock.json"),
	);
	await api.upload.createUpload.mutate(data);
	data.set("file", new File(["But this should."], "question.md"));
	await api.upload.createUpload.mutate(data);
	data.set(
		"file",
		new File(
			[FileFixtureUtils.buildPdf({ sentence: "So should this document." })],
			"handbook.pdf",
		),
	);
	await api.upload.createUpload.mutate(data);
});

describe("UploadUtils", () => {
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
			expect(UploadUtils.shouldIncludeFile({ path, extras: false })).toBe(true);
		}
	});

	it("accepts a path in either shape", () => {
		expect(
			UploadUtils.shouldIncludeFile({ path: ["node_modules", "dep.js"] }),
		).toBe(false);
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
		// A PDF never decodes as UTF-8, so it reaches the queue only because it
		// was unpacked on the way out.
		expect(
			missingEmbeddings?.files.find((file) =>
				file.text.includes("So should this document."),
			),
		).toBeDefined();
	});
});
