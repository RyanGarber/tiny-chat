import type { z } from "zod";
import {
	AgentStreamService,
	ToolStreamService,
} from "#client/core/services/StreamService.ts";
import type { zData } from "#core/features/data/types/part.ts";
import type { shell_exec } from "#core/features/tool/tools/shell/shell_exec.ts";

describe("stream snapshots", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		AgentStreamService.clear("snapshot");
		vi.useRealTimers();
	});

	it("detaches initial and flushed message data from the mutable producer", () => {
		const part = { id: "text", type: "text" as const, value: "one" };
		const data: zData = [[part]];
		AgentStreamService.start("snapshot", { initial: { data } });
		const initial = AgentStreamService.get("snapshot");

		part.value = "two";
		AgentStreamService.mutate("snapshot", { mode: "patch", data: { data } });
		expect(AgentStreamService.get("snapshot")).toBe(initial);
		expect(initial?.items[0].data[0][0]).toMatchObject({ value: "one" });
		vi.advanceTimersByTime(50);
		const second = AgentStreamService.get("snapshot");
		expect(second?.items[0].data).not.toBe(initial?.items[0].data);
		expect(second?.items[0].data[0][0]).toMatchObject({ value: "two" });

		part.value = "three";
		AgentStreamService.mutate("snapshot", { mode: "patch", data: { data } });
		vi.advanceTimersByTime(50);
		expect(
			AgentStreamService.get("snapshot")?.items[0].data[0][0],
		).toMatchObject({ value: "three" });
		expect(second?.items[0].data[0][0]).toMatchObject({ value: "two" });
	});

	it("detaches coalesced tool output while retaining filtering and truncation", () => {
		const service = ToolStreamService.of<{ value: string }>();
		const line = { value: "one" };
		service.start("snapshot", { maxItems: 2, keep: (item) => !!item.value });
		service.mutate("snapshot", { mode: "append", data: line });
		vi.advanceTimersByTime(50);
		const first = service.get("snapshot");
		line.value = "two";
		service.mutate("snapshot", { mode: "replace", data: line });
		service.mutate("snapshot", { mode: "append", data: { value: "" } });
		vi.advanceTimersByTime(50);
		expect(first?.items).toEqual([{ value: "one" }]);
		expect(service.get("snapshot")?.items).toEqual([{ value: "two" }]);
		service.mutate("snapshot", { mode: "append", data: { value: "three" } });
		vi.advanceTimersByTime(50);
		expect(service.get("snapshot")).toEqual({
			items: [{ value: "three" }],
			truncated: true,
		});
	});
});

const keep: (event: z.infer<typeof shell_exec.stream>) => boolean = (event) => {
	return event.value.length > 0;
};
const flush = () => vi.advanceTimersByTimeAsync(80);

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
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());
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
