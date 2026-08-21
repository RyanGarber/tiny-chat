import type { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { ToolStreamService } from "./StreamService.ts";

const keep: (event: z.infer<typeof shell_exec.stream>) => boolean = (event) => {
	return event.value.length > 0;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 80));

// TODO: this logic mirrors 1:1 what's in shell_exec; move this test to that directly
let buffer: z.infer<(typeof shell_exec)["stream"]> | undefined;
const start = (service: typeof ToolStreamService, key: string) => {
	service.start(key);
	buffer = undefined;
};
const mutate = (
	service: typeof ToolStreamService,
	key: string,
	event: z.infer<(typeof shell_exec)["stream"]>,
) => {
	event.value = event.value
		.replace(
			// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escapes is the point
			/\u001B\[[0-?]*[ -/]*[@-~]|\u001B][^\u0007]*(?:\u0007|\u001B\\)/g,
			"",
		)
		.replace(/\r\n/g, "\n");

	const pieces = event.value.split("\n");
	pieces.forEach((piece, index) => {
		if (!buffer || buffer?.type !== event.type || index > 0) {
			buffer = { type: event.type, value: "" };
			service.mutate?.(key, {
				mode: "append",
				data: buffer,
				options: { keep },
			});
		}

		// A carriage return rewrites the line it is on, which is how progress
		// bars and spinners report themselves.
		const rewrite = piece.lastIndexOf("\r");
		buffer.value =
			rewrite >= 0 ? piece.slice(rewrite + 1) : buffer.value + piece;
		service.mutate?.(key, { mode: "replace", data: buffer, options: { keep } });
	});
};

describe("ToolStreamService", () => {
	it("splits output into lines attributed to their stream", async () => {
		const key = "p";
		const service = ToolStreamService.of<z.infer<typeof shell_exec.stream>>();

		start(service, key);

		mutate(service, key, { type: "stdout", value: "one\ntw" });
		mutate(service, key, { type: "stdout", value: "o\n" });
		mutate(service, key, { type: "stderr", value: "bad\n" });

		await flush();

		expect(ToolStreamService.get(key)?.items).toEqual([
			{ type: "stdout", value: "one" },
			{ type: "stdout", value: "two" },
			{ type: "stderr", value: "bad" },
		]);

		ToolStreamService.clear(key);
	});

	it("lets a carriage return rewrite the line it is on", async () => {
		const key = "progress";
		const service = ToolStreamService.of<z.infer<typeof shell_exec.stream>>();

		start(service, key);

		mutate(service, key, {
			type: "stdout",
			value: "Loading...\n",
		});
		mutate(service, key, {
			type: "stdout",
			value: "10%\r20%\r30%",
		});
		mutate(service, key, {
			type: "stderr",
			value: "Failed\n",
		});

		await flush();

		expect(ToolStreamService.get(key)?.items).toEqual([
			{ type: "stdout", value: "Loading..." },
			{ type: "stdout", value: "30%" },
			{ type: "stderr", value: "Failed" },
		]);

		ToolStreamService.clear(key);
	});

	it("strips terminal colour codes", async () => {
		const key = "colour";
		const service = ToolStreamService.of<z.infer<typeof shell_exec.stream>>();

		start(service, key);

		mutate(service, key, {
			type: "stdout",
			value: "\u001B[32mpassed\u001B[0m\n",
		});

		await flush();

		expect(ToolStreamService.get(key)?.items).toEqual([
			{ type: "stdout", value: "passed" },
		]);

		ToolStreamService.clear(key);
	});

	it("notifies subscribers and drops everything once cleared", async () => {
		const key = "sub";
		const service = ToolStreamService.of<z.infer<typeof shell_exec.stream>>();

		const listener = vi.fn();
		const unsubscribe = ToolStreamService.subscribe(key, listener);

		start(service, key);

		mutate(service, key, { type: "stdout", value: "hello\n" });

		await flush();

		expect(listener).toHaveBeenCalled();

		ToolStreamService.clear(key);
		expect(ToolStreamService.get(key)).toBeUndefined();

		unsubscribe();
		expect(ToolStreamService.getSubscriberCount(key)).toBe(0);
	});
});
