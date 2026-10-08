import type { Key } from "ink";
import { describe, expect, it, vi } from "vitest";
import {
	type Bindings,
	ListBindingUtils,
} from "#tui/core/utils/ListBindingUtils.ts";

const key = (overrides: Partial<Key> = {}) => ({ ...overrides }) as Key;

type Item = { value: string; locked?: boolean };

const bindings = (): Bindings<Item> => ({
	primary: { name: "open", run: vi.fn() },
	toggle: { run: vi.fn() },
	edit: { run: vi.fn() },
	create: { run: vi.fn() },
	remove: { run: vi.fn(), when: (item) => !item.locked },
	reorder: { run: vi.fn() },
	refresh: { run: vi.fn() },
});

describe("ListBindingUtils.resolve", () => {
	it.each([
		["enter", "", key({ return: true }), "primary"],
		["space", " ", key(), "toggle"],
		["e", "e", key(), "edit"],
		["n", "n", key(), "create"],
		["d", "d", key(), "remove"],
		["r", "r", key(), "refresh"],
		["shift+up", "", key({ shift: true, upArrow: true }), "reorder"],
	])("maps %s", (_name, input, k, verb) => {
		expect(ListBindingUtils.resolve(input, k)?.verb).toBe(verb);
	});

	it("never maps ctrl or meta chords", () => {
		expect(ListBindingUtils.resolve("d", key({ ctrl: true }))).toBeNull();
		expect(ListBindingUtils.resolve("e", key({ meta: true }))).toBeNull();
	});

	it("gives reorder its direction", () => {
		expect(
			ListBindingUtils.resolve("", key({ shift: true, downArrow: true })),
		).toEqual({ verb: "reorder", direction: 1 });
	});
});

describe("ListBindingUtils.handle", () => {
	const item = { value: "a" };

	it("arms on the first d rather than removing", () => {
		expect(
			ListBindingUtils.handle({
				bindings: bindings(),
				item,
				input: "d",
				key: key(),
				armed: false,
			}),
		).toEqual({ type: "arm" });
	});

	it("confirms an armed row with d or Enter", () => {
		for (const [input, k] of [
			["d", key()],
			["", key({ return: true })],
		] as const) {
			expect(
				ListBindingUtils.handle({
					bindings: bindings(),
					item,
					input,
					key: k,
					armed: true,
				}),
			).toEqual({ type: "confirm" });
		}
	});

	it("disarms on any other key, leaving back to the page", () => {
		const handle = (input: string, k: Key) =>
			ListBindingUtils.handle({
				bindings: bindings(),
				item,
				input,
				key: k,
				armed: true,
			});
		expect(handle("", key({ downArrow: true }))).toEqual({ type: "disarm" });
		expect(handle("x", key())).toEqual({ type: "disarm" });
		expect(handle("", key({ escape: true }))).toBeNull();
	});

	it("ignores verbs that do not apply to the row", () => {
		expect(
			ListBindingUtils.handle({
				bindings: bindings(),
				item: { value: "b", locked: true },
				input: "d",
				key: key(),
				armed: false,
			}),
		).toBeNull();
	});

	it("arms on Enter for a row that is only there to remove", () => {
		expect(
			ListBindingUtils.handle({
				bindings: { remove: { run: vi.fn(), byEnter: true } },
				item,
				input: "",
				key: key({ return: true }),
				armed: false,
			}),
		).toEqual({ type: "arm" });
	});

	it("runs list verbs without a row", () => {
		expect(
			ListBindingUtils.handle({
				bindings: bindings(),
				item: undefined,
				input: "n",
				key: key(),
				armed: false,
			}),
		).toEqual({ type: "run", verb: "create" });
	});
});

describe("ListBindingUtils.help", () => {
	it("lists verbs in one order, whatever order they were declared in", () => {
		const { refresh, remove, primary, create } = bindings();
		expect(
			ListBindingUtils.help(
				{ refresh, remove, primary, create },
				{
					value: "a",
				},
			).map(({ key }) => key),
		).toEqual(["enter", "n", "d", "r"]);
	});

	it("leaves out what the row cannot do", () => {
		expect(
			ListBindingUtils.help(bindings(), { value: "a", locked: true }).map(
				({ verb }) => verb,
			),
		).not.toContain("remove");
	});

	it("does not repeat what Enter already does", () => {
		const help = ListBindingUtils.help(
			{
				primary: { name: "toggle", run: vi.fn() },
				toggle: { run: vi.fn() },
			},
			{ value: "a" },
		);
		expect(help.map(({ verb }) => verb)).toEqual(["primary"]);
	});

	it("asks to confirm while armed", () => {
		expect(
			ListBindingUtils.help(bindings(), { value: "a" }, { armed: true }),
		).toEqual([
			{ key: "d", name: "confirm", verb: "remove" },
			{ key: "esc", name: "cancel", verb: "cancel" },
		]);
	});
});
