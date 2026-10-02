import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { mockConfig } from "@tiny-chat/core/tests.ts";
import { testClient } from "../../../tests.ts";

describe("file", () => {
	const { api } = testClient();

	it("stops a command when the client drops the request", async () => {
		const { chatId } = await api.message.createMessage.mutate({
			author: "USER",
			config: mockConfig(),
			data: [[{ id: CommonUtils.getRandomId(), type: "text", value: "exec" }]],
			metadata: [],
		});

		const abort = new AbortController();
		setTimeout(() => abort.abort(), 500);
		await expect(
			api.file.exec.mutate(
				{ chat: chatId, command: "sleep 30" },
				{ signal: abort.signal },
			),
		).rejects.toThrow();

		// The chat's shell runs one command at a time; the next one only gets
		// through quickly if the server let go of the first.
		const started = Date.now();
		const { stdout } = await api.file.exec.mutate({
			chat: chatId,
			command: "pwd",
		});
		expect(stdout.trim()).toBe("/mnt");
		expect(Date.now() - started).toBeLessThan(5_000);
	});
});
