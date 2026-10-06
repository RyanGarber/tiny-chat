import type { CompletionGroup } from "#client/features/editor/types/completion.ts";
import Text from "#tui/core/components/Text.tsx";
import Completions from "#tui/features/editor/components/Completions.tsx";
import type { ChoiceItem } from "#tui/features/settings/components/Choice.tsx";
import Textarea from "#tui/features/textarea/components/Textarea.tsx";

export interface TextEntry {
	/** Names the entry when the list is fixed, such as a provider's settings. */
	label?: string;
	text: string;
	detail?: string;
	error?: boolean;
}

/** `null` is the row that adds an entry. */
export type Draft = { index: number | null; text: string };

interface TextItem extends ChoiceItem {
	index: number | null;
	entry?: TextEntry;
}

/**
 * A submenu over a list of texts — instructions, commands, folders, keys —
 * each written in place where it is listed.
 *
 * The draft lives with the page so that going back cancels it first.
 */
export default function TextList({
	entries,
	draft,
	setDraft,
	placeholder,
	onAdd,
	onEdit,
	onRemove,
	onSelect,
	onKey,
	mask,
	actions = [],
}: {
	entries: TextEntry[];
	draft: Draft | null;
	setDraft: (draft: Draft | null) => void;
	placeholder: string;
	/** Left out when the list is a fixed set. */
	onAdd?: (text: string) => void;
	onEdit?: (index: number, text: string) => void;
	/** Left out when its entries cannot be dropped. */
	onRemove?: (index: number) => void;
	/** Takes the place of editing on `enter`. */
	onSelect?: (index: number) => void;
	onKey?: (_: { index: number | null; input: string }) => boolean | undefined;
	/** Hides all but the end of a text that is not being written. */
	mask?: boolean;
	actions?: { key: string; name: string }[];
}) {
	const groups: CompletionGroup<TextItem>[] = [
		{
			items: [
				...entries.map(
					(entry, index): TextItem => ({
						name: entry.label ?? entry.text,
						value: `${index}:${entry.label ?? entry.text}`,
						index,
						entry,
					}),
				),
				...(onAdd
					? [{ name: "add", value: "add", index: null } satisfies TextItem]
					: []),
			],
		},
	];

	const commit = (value: string) => {
		if (!draft) return;
		const text = value.trim();
		const { index } = draft;
		setDraft(null);
		if (index === null) {
			if (text) onAdd?.(text);
			return;
		}
		if (text === entries[index]?.text) return;
		if (text || !onRemove) onEdit?.(index, text);
		else onRemove(index);
	};

	return (
		<Completions<{ items: TextItem[] }, TextItem>
			groups={groups}
			selectFirstOnChange={false}
			// The text area wraps to the width it is given; a row sized to its
			// content would give it only what it already holds.
			itemProps={{ flexGrow: 1, flexShrink: 1 }}
			onInput={({ item, key, input }) => {
				// The text area takes every key while a draft is open.
				if (draft) return false;
				if (!item) return;
				if (key.return) {
					if (item.index !== null && onSelect) onSelect(item.index);
					else if (item.index === null || onEdit)
						setDraft({ index: item.index, text: item.entry?.text ?? "" });
					return true;
				}
				if (input === "d" && item.index !== null && onRemove) {
					onRemove(item.index);
					return true;
				}
				return onKey?.({ index: item.index, input });
			}}
			renderItem={({ item, selected }) => {
				const editing = draft?.index === item.index && draft !== null;
				if (editing && draft) {
					return (
						<>
							{item.entry?.label && <Text>{item.entry.label}</Text>}
							<Textarea
								focus={selected}
								value={draft.text}
								onChange={(text) => setDraft({ ...draft, text })}
								// An entry is committed by Enter, under a modifier or not.
								onEnter={() => commit(draft.text)}
								onSubmit={commit}
								placeholder={placeholder}
							/>
						</>
					);
				}
				if (!item.entry) return <Text color="textSubtle">+ {placeholder}</Text>;
				const { label, text, detail, error } = item.entry;
				const shown =
					mask && text
						? `${"•".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`
						: text;
				return (
					<>
						{label && <Text>{label}</Text>}
						<Text color={error ? "redBright" : label ? "text" : undefined}>
							{shown || (label ? "(none)" : "")}
							{detail && <Text color="textSubtle"> · {detail}</Text>}
						</Text>
					</>
				);
			}}
			renderEmpty={() => "nothing here yet"}
			actions={[
				...(onSelect ? [] : [{ key: "enter", name: "edit" }]),
				...(onRemove ? [{ key: "d", name: "remove" }] : []),
				...actions,
				"back",
			]}
		/>
	);
}
