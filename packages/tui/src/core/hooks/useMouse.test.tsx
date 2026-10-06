import { describe, expect, it, vi } from "vitest";
import { useMouse } from "#tui/core/hooks/useMouse.ts";
import { render } from "#tui/core/utils/RenderTestUtils.tsx";

const report = "\x1b[<0;10;20M";

function Listener(props: Parameters<typeof useMouse>[0]) {
	useMouse(props);
	return null;
}

describe("mouse subscriptions", () => {
	it("isolates simultaneous Ink roots and writes tracking to each injected stdout", async () => {
		const a = vi.fn();
		const b = vi.fn();
		const first = render(<Listener handler={a} />);
		const second = render(<Listener handler={b} />);
		await Promise.all([first.idle(), second.idle()]);
		expect(first.stdout.writes.join("")).toContain("\x1b[?1000h\x1b[?1006h");
		expect(second.stdout.writes.join("")).toContain("\x1b[?1000h\x1b[?1006h");
		first.stdin.write(report);
		await first.idle();
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).not.toHaveBeenCalled();
		first.cleanup();

		expect(first.filtered.listenerCount("mouse")).toBe(0);
		expect(first.stdin.isRaw).toBe(false);
		second.stdin.write(report);
		await second.idle();
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
		expect(second.stdin.isRaw).toBe(true);
		second.cleanup();

		expect(second.stdin.isRaw).toBe(false);
	});

	it("restores drag and click tracking as broader subscribers leave", async () => {
		const handler = vi.fn();
		const tree = (motion: boolean, drag: boolean) => (
			<>
				<Listener handler={handler} />
				{drag && <Listener handler={handler} drag />}
				{motion && <Listener handler={handler} motion />}
			</>
		);
		const screen = render(tree(true, true));
		await screen.idle();
		expect(screen.stdout.writes.join("")).toContain("\x1b[?1003h");
		screen.stdout.writes.length = 0;
		screen.rerender(tree(false, true));
		await screen.idle();
		expect(screen.stdout.writes.join("")).toBe("\x1b[?1003l\x1b[?1002h");
		screen.stdout.writes.length = 0;
		screen.rerender(tree(false, false));
		await screen.idle();
		expect(screen.stdout.writes.join("")).toBe(
			"\x1b[?1002l\x1b[?1000h\x1b[?1006h",
		);
		screen.stdin.write(report);
		await screen.idle();
		expect(handler).toHaveBeenCalledTimes(1);
		screen.cleanup();
		expect(screen.stdout.writes.join("")).toContain(
			"\x1b[?1003l\x1b[?1002l\x1b[?1006l\x1b[?1000l",
		);
	});

	it("does not subscribe when inactive and uses the latest handler without resubscribing", async () => {
		const first = vi.fn();
		const next = vi.fn();
		const screen = render(<Listener handler={first} isActive={false} />);
		await screen.idle();
		expect(screen.filtered.listenerCount("mouse")).toBe(0);
		expect(screen.stdin.isRaw).toBe(false);
		screen.rerender(<Listener handler={first} />);
		await screen.idle();
		const writes = screen.stdout.writes.join("");
		screen.rerender(<Listener handler={next} />);
		await screen.idle();
		expect(screen.stdout.writes.join("")).toBe(writes);
		screen.stdin.write(report);
		await screen.idle();
		expect(first).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
		screen.rerender(<Listener handler={next} isActive={false} />);
		await screen.idle();
		expect(screen.filtered.listenerCount("mouse")).toBe(0);
		expect(screen.stdin.isRaw).toBe(false);
		screen.stdin.write(report);
		await screen.idle();
		expect(next).toHaveBeenCalledTimes(1);
		screen.cleanup();
	});
});
