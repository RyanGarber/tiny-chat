import { stripVTControlCharacters } from "node:util";
import { beforeEach, expect, it, vi } from "vitest";
import { useEditorStore } from "../../features/editor/stores/useEditorStore.ts";
import render from "../../tests.ts";
import { selectFocus, useAppStore } from "../stores/useAppStore.ts";
import App from "./App.tsx";

beforeEach(() => {
	useAppStore.setState({
		focus: "editor",
		panels: { chats: false, files: false },
		statuses: [],
	});
	useEditorStore.setState({
		content: "",
		cursor: [0, 0],
		selection: null,
	});
});

const focus = () => selectFocus(useAppStore.getState());
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

it("keeps panels open through focus changes and only routes keys to the focused surface", async () => {
	const screen = await render(<App />);
	useAppStore.getState().togglePanel("chats");
	useAppStore.getState().togglePanel("files");
	await settle();
	const press = async (key: string) => {
		screen.stdin.write(key);
		await settle();
	};

	await press("\t");
	expect(focus()).toBe("editor");
	await press("hello");
	await press("\x7f");
	expect(useEditorStore.getState().content).toBe("hell");
	expect(useAppStore.getState().panels).toEqual({ chats: true, files: true });

	await press("\t");
	expect(focus()).toBe("chats");
	await press("\t");
	expect(focus()).toBe("files");
	await press("x");
	expect(useAppStore.getState().panels).toEqual({ chats: true, files: false });
	expect(focus()).toBe("editor");
	expect(useEditorStore.getState().content).toBe("hell");

	await press("\t");
	expect(focus()).toBe("chats");
	await press("\x1b");
	expect(useAppStore.getState().panels).toEqual({ chats: false, files: false });
	expect(focus()).toBe("editor");
});

it("toggles panels with their commands without hiding the other panel", async () => {
	const screen = await render(<App />);
	const run = async (command: string) => {
		screen.stdin.write(command);
		await settle();
		screen.stdin.write("\r");
		await settle();
	};
	await run("/chats");
	await vi.waitFor(() =>
		expect(useAppStore.getState().panels.chats).toBe(true),
	);
	screen.stdin.write("\t");
	await settle();
	await run("/files");
	expect(useAppStore.getState().panels).toEqual({ chats: true, files: true });
	screen.stdin.write("\t");
	await settle();
	await run("/chats");
	expect(useAppStore.getState().panels).toEqual({ chats: false, files: true });
	await run("/files");
	expect(useAppStore.getState().panels).toEqual({ chats: false, files: false });
});

it("keeps equal-width panels visible across terminal resizing and closes them by mouse", async () => {
	const screen = await render(<App />);
	useAppStore.getState().togglePanel("chats");
	useAppStore.getState().togglePanel("files");
	const frame = () => stripVTControlCharacters(screen.lastFrame() ?? "");
	for (const columns of [160, 120, 100]) {
		screen.stdout.columns = columns;
		screen.stdout.emit("resize");
		await settle();
		const header = frame()
			.split("\n")
			.find((line) => line.includes("chats") && line.includes("files"));
		expect(header).toBeDefined();
		const line = header ?? "";
		expect(line.indexOf("[x]") - line.indexOf("chats")).toBe(
			line.lastIndexOf("[x]") - line.indexOf("files"),
		);
		expect(useAppStore.getState().panels).toEqual({ chats: true, files: true });
	}
	const lines = frame().split("\n");
	const row = lines.findIndex(
		(line) => line.includes("chats") && line.includes("files"),
	);
	const column = lines[row].lastIndexOf("[x]") + 2;
	screen.stdin.write(
		`\x1b[<0;${column};${row + 1}M\x1b[<0;${column};${row + 1}m`,
	);
	await vi.waitFor(() =>
		expect(useAppStore.getState().panels).toEqual({
			chats: true,
			files: false,
		}),
	);
});

it("knows the focusables on screen, in Tab order, and falls back to the editor", async () => {
	await render(<App />);
	useAppStore.getState().togglePanel("files");
	useAppStore.getState().togglePanel("chats");
	await settle();
	expect(useAppStore.getState().focusables).toEqual([
		"editor",
		"chats",
		"files",
	]);
	expect(focus()).toBe("chats");

	// A focus that leaves the screen hands it back to the editor.
	useAppStore.setState({ focus: "tool:gone" });
	expect(focus()).toBe("editor");

	useAppStore.getState().cycleFocus(-1);
	expect(focus()).toBe("files");
	useAppStore.getState().closePanel("files");
	await settle();
	expect(useAppStore.getState().focusables).toEqual(["editor", "chats"]);
	expect(focus()).toBe("editor");
});
