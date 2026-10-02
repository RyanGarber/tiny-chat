import { useToolFeedback } from "@tiny-chat/client/features/part/hooks/useToolFeedback.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolControls as ToolControlsType } from "@tiny-chat/core/features/tool/types/display.ts";
import { useCallback, useMemo, useState } from "react";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";
import { useEditorStore } from "../../editor/stores/useEditorStore.ts";
import Textarea from "../../textarea/components/Textarea.tsx";

interface Item {
	name?: string;
	value: string;
	field?: string;
	custom?: boolean;
	approved?: boolean;
	submit?: boolean;
}

/** Write-in fields precede the approval/continue choices; suggestions fill a field. */
export default function ToolControls({
	message,
	part,
	controls,
	isFocused: isNext = false,
}: {
	message: MessageState;
	part: zToolCallPart;
	controls: ToolControlsType;
	isFocused?: boolean;
}) {
	const focusedFeedbackId = useEditorStore((s) => s.focusedFeedbackId);
	const isFocused = isNext && focusedFeedbackId === part.id;
	const { values, setValue, submit, locked, mutation } = useToolFeedback({
		message,
		part,
		controls,
	});
	useWorkingStatus(mutation);

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
		<Completions<{ items: Item[] }, Item>
			active={isFocused && !locked}
			onPointerDown={() => {
				if (!locked && isNext)
					useEditorStore.setState({ focusedFeedbackId: part.id });
			}}
			groups={groups}
			selected={selected}
			setSelected={updateSelected}
			renderItem={({ item, selected: isSelected }) => {
				if (item.custom && item.field) {
					const field = item.field;
					return (
						<Textarea
							focus={isFocused && isSelected && !locked}
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
				return item.name;
			}}
			onInput={({ item, key, pointer }) => {
				if (locked || !isNext) return false;
				if (pointer) useEditorStore.setState({ focusedFeedbackId: part.id });
				else if (!isFocused) return false;

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
							.findIndex((entry) => entry.custom && entry.field === field.name);
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
					if (controls.fields.some((field) => !values[field.name])) {
						const position = groups
							.flatMap((group) => group.items)
							.findIndex((entry) =>
								controls.fields.some(
									(field) => field.name === entry.field && !values[field.name],
								),
							);
						if (position >= 0) setSelected(position);
						return false;
					}
					useEditorStore.setState({ focusedFeedbackId: null });
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
	);
}
