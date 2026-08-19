import { describe, expect, it, vi } from "vitest";
import { ToolStreamService } from "./ToolStreamService.ts";

/** Bursts are coalesced, so a snapshot only lands after the flush window. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 80));

describe("ToolStreamService", () => {
	it("splits output into lines attributed to their stream", async () => {
		const key = ToolStreamService.key({ messageId: "m", partId: "p" });
		ToolStreamService.start(key);

		ToolStreamService.push(key, { stream: "stdout", value: "one\ntw" });
		ToolStreamService.push(key, { stream: "stdout", value: "o\n" });
		ToolStreamService.push(key, { stream: "stderr", value: "bad\n" });
		await flush();

		expect(ToolStreamService.get(key)?.lines).toEqual([
			{ stream: "stdout", value: "one" },
			{ stream: "stdout", value: "two" },
			{ stream: "stderr", value: "bad" },
		]);

		ToolStreamService.clear(key);
	});

	it("lets a carriage return rewrite the line it is on", async () => {
		const key = ToolStreamService.key({ messageId: "m", partId: "progress" });
		ToolStreamService.start(key);

		ToolStreamService.push(key, { stream: "stdout", value: "10%\r20%\r30%" });
		await flush();

		expect(ToolStreamService.get(key)?.lines).toEqual([
			{ stream: "stdout", value: "30%" },
		]);

		ToolStreamService.clear(key);
	});

	it("strips terminal colour codes", async () => {
		const key = ToolStreamService.key({ messageId: "m", partId: "colour" });
		ToolStreamService.start(key);

		ToolStreamService.push(key, {
			stream: "stdout",
			value: "\u001B[32mpassed\u001B[0m\n",
		});
		await flush();

		expect(ToolStreamService.get(key)?.lines).toEqual([
			{ stream: "stdout", value: "passed" },
		]);

		ToolStreamService.clear(key);
	});

	it("notifies subscribers and drops everything once cleared", async () => {
		const key = ToolStreamService.key({ messageId: "m", partId: "sub" });
		const listener = vi.fn();
		const unsubscribe = ToolStreamService.subscribe(key, listener);

		ToolStreamService.start(key);
		ToolStreamService.push(key, { stream: "stdout", value: "hello\n" });
		await flush();
		expect(listener).toHaveBeenCalled();

		ToolStreamService.finish(key);
		expect(ToolStreamService.get(key)?.done).toBe(true);

		ToolStreamService.clear(key);
		expect(ToolStreamService.get(key)).toBeUndefined();

		unsubscribe();
		expect(ToolStreamService.getSubscriberCount(key)).toBe(0);
	});
});
