import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type {
	zBrowserRunResult,
	zBrowserStatus,
	zBrowserStep,
} from "@tiny-chat/core/features/tool/types/browser.ts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserDriverUtils } from "./BrowserDriverUtils.ts";

const PAGE = `data:text/html,${encodeURIComponent(`<title>Form</title>
<nav><a href="/home">Home</a></nav>
<h1>Sign <i>up</i></h1>
<label>Name <input placeholder="your name"></label>
<select><option>Red</option><option value="g">Green</option></select>
<button onclick="console.log('sent', document.querySelector('input').value); document.title = 'sent'">Send</button>
<div style="display: none">hidden</div>`)}`;

/** The driver as the client runs it: `node -e`, JSON-RPC over stdio. */
describe("BrowserDriverUtils", () => {
	let child: ChildProcess;
	let next = 0;
	const pending = new Map<number, (message: any) => void>();

	const call = <T>(method: string, params: object) =>
		new Promise<T>((resolve, reject) => {
			const id = ++next;
			pending.set(id, (message) =>
				message.error
					? reject(new Error(message.error.message))
					: resolve(message.result),
			);
			child.stdin?.write(
				`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
			);
		});

	let status: zBrowserStatus;
	const run = (steps: zBrowserStep[], screenshot?: boolean) =>
		call<zBrowserRunResult>("run", {
			steps,
			screenshot,
			playwright: status.playwright?.path,
			executablePath: status.browser?.path,
			headless: true,
		});

	beforeAll(async () => {
		child = spawn(process.execPath, ["-e", BrowserDriverUtils.script]);
		createInterface({ input: child.stdout as NodeJS.ReadableStream }).on(
			"line",
			(line) => {
				const message = JSON.parse(line);
				pending.get(message.id)?.(message);
			},
		);
		status = await call<zBrowserStatus>("detect", { cwd: process.cwd() });
	});

	afterAll(async () => {
		await call("close", {}).catch(() => {});
		child.stdin?.end();
	});

	it("reports what it found", () => {
		expect(status.node?.path).toBe(process.execPath);
		expect(status.available).toBe(!!status.playwright && !!status.browser);
	});

	it("reads a page as a tree and acts on its refs", async (context) => {
		if (!status.available) context.skip();

		const read = await run([
			{ action: "navigate", url: PAGE },
			{ action: "read" },
		]);
		const tree = String(read.steps[1]?.value);
		expect(tree).toContain('heading "Sign up" [level=1]');
		expect(tree).toMatch(
			/textbox "Name" \[placeholder="your name"\] \[ref=e\d+\]/,
		);
		expect(tree).not.toContain("hidden");
		const ref = /textbox "Name".*\[ref=(e\d+)\]/.exec(tree)?.[1] ?? "";

		const result = await run(
			[
				{ action: "type", ref, text: "Ada" },
				{ action: "type", selector: "select", text: "Green" },
				{ action: "click", selector: "text=Send" },
				{ action: "wait", script: "document.title === 'sent'" },
				{
					action: "evaluate",
					script: "document.querySelector('select').value",
				},
				{ action: "console" },
				{ action: "click", ref: "e999" },
				{ action: "read" },
			],
			true,
		);
		expect(result.title).toBe("sent");
		expect(result.steps.map((step) => step.ok)).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
			false,
		]);
		expect(result.steps[4]?.value).toBe("g");
		expect(result.steps[5]?.value).toEqual(["[log] sent Ada"]);
		expect(result.steps[6]?.error).toContain("read the page again");
		expect(result.skipped).toBe(1);
		expect(result.screenshots).toHaveLength(1);
		expect(result.screenshots[0]?.mime).toBe("image/jpeg");
	}, 60_000);
});
