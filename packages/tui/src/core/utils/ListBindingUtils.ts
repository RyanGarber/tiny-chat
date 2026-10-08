import type { Key } from "ink";

/** What a key does to a list row: the same key means the same thing everywhere. */
export type Verb =
	| "primary"
	| "toggle"
	| "edit"
	| "create"
	| "remove"
	| "reorder"
	| "refresh";

interface ItemBinding<T> {
	run: (item: T) => void;
	/** Left out of the keys and the help for a row it does not apply to. */
	when?: (item: T) => boolean;
}

/**
 * The verbs a list answers to, declared rather than read off raw keys, so that
 * every list takes the same keys and draws the same help in the same order.
 * Anything an item does beyond these belongs on its details page, reached
 * with `edit`.
 */
export interface Bindings<T> {
	/** Enter, and a press on the selected row: the one thing a row is mostly for. */
	primary?: ItemBinding<T> & { name: string | ((item: T) => string) };
	/** Space, on a row that is on or off. */
	toggle?: ItemBinding<T>;
	/** `e`: the item's details page, or its text written in place. */
	edit?: ItemBinding<T>;
	/** `n`: a new item in the list. */
	create?: { run: () => void; name?: string };
	/**
	 * `d`, pressed twice: the first arms the row, the second (or Enter) goes
	 * through. `remove` when the item is only taken off the list, `delete` when
	 * it is gone for good.
	 */
	remove?: ItemBinding<T> & {
		name?: "delete" | "remove";
		/** What the armed row asks, in place of `delete "<name>"?`. */
		label?: (item: T) => string;
		/** Enter arms it too, on a row that is there only to remove. */
		byEnter?: boolean;
	};
	/** Shift+↑↓, on a list whose order is the user's. */
	reorder?: {
		run: (item: T, direction: -1 | 1) => void;
		when?: (item: T) => boolean;
	};
	/** `r`: fetch, check, or connect again. */
	refresh?: { run: (item?: T) => void; name?: string };
}

/** The order help is drawn in, whatever order a list declares its verbs in. */
const ORDER: Verb[] = [
	"primary",
	"toggle",
	"edit",
	"create",
	"remove",
	"reorder",
	"refresh",
];

const applies = <T>(
	binding: { when?: (item: T) => boolean } | undefined,
	item: T | undefined,
) => !!binding && (!binding.when || (item !== undefined && binding.when(item)));

export const ListBindingUtils = {
	/** The verb a key stands for, if any. Ctrl and Meta chords are never verbs. */
	resolve: (
		input: string,
		key: Key,
	): { verb: Verb; direction?: -1 | 1 } | null => {
		if (key.shift && (key.upArrow || key.downArrow)) {
			return { verb: "reorder", direction: key.upArrow ? -1 : 1 };
		}
		if (key.return) return { verb: "primary" };
		if (key.ctrl || key.meta) return null;
		if (input === " ") return { verb: "toggle" };
		if (input === "e") return { verb: "edit" };
		if (input === "n") return { verb: "create" };
		if (input === "d") return { verb: "remove" };
		if (input === "r") return { verb: "refresh" };
		return null;
	},

	/** Whether a verb is bound for the row under the cursor. */
	available: <T>(bindings: Bindings<T>, verb: Verb, item: T | undefined) => {
		switch (verb) {
			case "create":
			case "refresh":
				return !!bindings[verb];
			case "reorder":
				return applies(bindings.reorder, item);
			default:
				return item !== undefined && applies(bindings[verb], item);
		}
	},

	/**
	 * What a key does on a list: run a verb, or answer an armed row, which only
	 * `d` or Enter put through. Back (Escape, Backspace) is left to the page,
	 * which disarms before it leaves.
	 */
	handle: <T>({
		bindings,
		item,
		input,
		key,
		armed,
	}: {
		bindings: Bindings<T>;
		item: T | undefined;
		input: string;
		key: Key;
		armed: boolean;
	}):
		| { type: "run"; verb: Verb; direction?: -1 | 1 }
		| { type: "arm" }
		| { type: "confirm" }
		| { type: "disarm" }
		| null => {
		const resolved = ListBindingUtils.resolve(input, key);
		if (armed) {
			if (key.escape || key.backspace) return null;
			if (resolved?.verb === "remove" || resolved?.verb === "primary") {
				return { type: "confirm" };
			}
			return { type: "disarm" };
		}
		if (!resolved) return null;
		if (
			resolved.verb === "primary" &&
			bindings.remove?.byEnter &&
			ListBindingUtils.available(bindings, "remove", item)
		) {
			return { type: "arm" };
		}
		if (!ListBindingUtils.available(bindings, resolved.verb, item)) return null;
		if (resolved.verb === "remove") return { type: "arm" };
		return { type: "run", ...resolved };
	},

	/** The help for the row under the cursor, in the one order every list uses. */
	help: <T>(
		bindings: Bindings<T>,
		item: T | undefined,
		{ armed = false }: { armed?: boolean } = {},
	): { key: string; name: string; verb: Verb | "cancel" }[] => {
		if (armed) {
			return [
				{ key: "d", name: "confirm", verb: "remove" },
				{ key: "esc", name: "cancel", verb: "cancel" },
			];
		}
		const primary =
			typeof bindings.primary?.name === "function"
				? item && bindings.primary.name(item)
				: bindings.primary?.name;
		const names: Record<Verb, [string, string | undefined]> = {
			primary: ["enter", primary],
			toggle: ["space", "toggle"],
			edit: ["e", "edit"],
			create: ["n", bindings.create?.name ?? "new"],
			remove: ["d", bindings.remove?.name ?? "delete"],
			reorder: ["⇧↑↓", "reorder"],
			refresh: ["r", bindings.refresh?.name ?? "refresh"],
		};
		return ORDER.flatMap((verb) => {
			const [key, name] = names[verb];
			if (!name || !ListBindingUtils.available(bindings, verb, item)) return [];
			// Enter already does it, so the help would only say it twice.
			if (verb === "edit" && primary === "edit") return [];
			if (verb === "toggle" && primary === "toggle") return [];
			return [{ key, name, verb }];
		});
	},
} as const;
