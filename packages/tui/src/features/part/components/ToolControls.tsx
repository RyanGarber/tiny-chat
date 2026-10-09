import { useCallback, useMemo, useState } from "react";
import { useToolFeedback } from "#client/features/part/hooks/useToolFeedback.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { zToolCallPart } from "#core/features/data/types/part.ts";
import type { ToolControls as ToolControlsType } from "#core/features/tool/types/display.ts";
import Panel, { useFocused } from "#tui/core/components/Panel.tsx";
import Text from "#tui/core/components/Text.tsx";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import { useAppStore } from "#tui/core/stores/useAppStore.ts";
import Completions from "#tui/features/editor/components/Completions.tsx";
import Textarea from "#tui/features/textarea/components/Textarea.tsx";

interface Item {
	name?: string;
	value: string;
	field?: string;
	custom?: boolean;
	approved?: boolean;
	submit?: boolean;
}

/**
 * Write-in fields precede the approval/continue choices; suggestions fill a
 * field. Any call waiting on feedback, and not yet answered, can take the
 * focus.
 */
export default function ToolControls({
	message,
	part,
	controls,
	answerable = false,
}: {
	message: MessageState;
	part: zToolCallPart;
	controls: ToolControlsType;
	answerable?: boolean;
}) {
	const id = `tool:${part.id}` as const;
	const setFocus = useAppStore((state) => state.setFocus);
	const { values, setValue, submit, locked, complete, mutation } =
		useToolFeedback({
			message,
			part,
			controls,
		});
	useWorkingStatus(mutation);
	const disabled = locked || !answerable;
	const focused = useFocused(id) && !disabled;

	const [selected, setSelected] = useState(0);
	// Completions resets to the first item whenever this changes identity.
	const updateSelected = useCallback(
		(update: (previous?: number) => number) =>
			setSelected((previous) => update(previous)),
		[],
	);
	const [suggestionIndex, setSuggestionIndex] = useState<
		Record<string, number>
	>({});
	const groups = useMemo(() => {
		const fields = controls.fields.map((field) => ({
			items: [
				...(field.custom
					? [
							{
								value: `custom:${field.name}`,
								field: field.name,
								custom: true,
							} satisfies Item,
						]
					: field.options.map(
							(option): Item => ({
								name: option,
								value: option,
								field: field.name,
							}),
						)),
			],
		}));
		const actions: Item[] = controls.approval
			? [
					{ name: "approve", value: "approve", submit: true, approved: true },
					{ name: "deny", value: "deny", submit: true, approved: false },
				]
			: [{ name: "continue", value: "continue", submit: true }];
		return [...fields, { items: actions }];
	}, [controls]);

	return (
		<Panel id={id} disabled={disabled}>
			<Completions<{ items: Item[] }, Item>
				groups={groups}
				selected={selected}
				setSelected={updateSelected}
				renderItem={({ item, selected: isSelected }) => {
					if (item.custom && item.field) {
						const field = item.field;
						return (
							<Textarea
								focus={focused && isSelected}
								styles={
									!focused ? { text: { color: "textSubtle" } } : undefined
								}
								value={values[field] ?? ""}
								onChange={(value) => setValue(field, value)}
								// Enter moves on to the submit action rather than breaking the line.
								onEnter={() => {}}
								placeholder={
									controls.fields.find((entry) => entry.name === field)
										?.placeholder ?? "something else..."
								}
							/>
						);
					}
					// Deny can be sent without filling the fields; approve and continue cannot.
					const unavailable =
						item.submit && item.approved !== false && !complete;
					return (
						<Text color={!focused || unavailable ? "textSubtle" : undefined}>
							{item.name}
						</Text>
					);
				}}
				onInput={({ item, key, pointer }) => {
					if (key.shift && key.tab) {
						const field =
							controls.fields.find(
								(entry) => entry.name === item?.field && entry.options.length,
							) ??
							controls.fields.find(
								(entry) => entry.custom && entry.options.length,
							);
						if (field) {
							const index = (suggestionIndex[field.name] ?? -1) + 1;
							setValue(field.name, field.options[index % field.options.length]);
							setSuggestionIndex((previous) => ({
								...previous,
								[field.name]: index,
							}));
							const position = groups
								.flatMap((group) => group.items)
								.findIndex(
									(entry) => entry.custom && entry.field === field.name,
								);
							if (position >= 0) setSelected(position);
						}
						return false;
					}
					// Shift and the arrows belong to the textarea's text selection.
					if (key.shift) return false;
					// Clicking a textarea positions its cursor, not the submit action.
					if (pointer && item?.custom) return false;

					if (key.return && item) {
						if (item.field) {
							if (item.custom) {
								setSelected(
									groups
										.flatMap((group) => group.items)
										.findIndex((entry) => entry.submit),
								);
								return false;
							}
							setValue(item.field, item.value);
							return false;
						}
						if (!item.submit) return false;
						if (item.approved !== false && !complete) {
							const position = groups
								.flatMap((group) => group.items)
								.findIndex((entry) =>
									controls.fields.some(
										(field) =>
											field.name === entry.field && !values[field.name],
									),
								);
							if (position >= 0) setSelected(position);
							return false;
						}
						setFocus("editor");
						submit(item.approved);
						return false;
					}
				}}
				actions={[
					"select",
					...(controls.fields.some(
						(field) => field.custom && field.options.length,
					)
						? [{ key: "shift+tab", name: "suggestion" }]
						: []),
				]}
			/>
		</Panel>
	);
}
