import { beforeAll, describe, expect, it } from "vitest";
import { testClient } from "../../../tests.ts";

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
