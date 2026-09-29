import { useToolFeedback } from "@tiny-chat/client/features/part/hooks/useToolFeedback.ts";
import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolControls as ToolControlsType } from "@tiny-chat/core/features/tool/types/display.ts";
import { useCallback, useMemo, useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";
import Textarea from "../../editor/components/Textarea.tsx";
import { useEditorStore } from "../../editor/stores/useEditorStore.ts";

interface Option {
	label: string;
	approved?: boolean;
}

/** An item a field's value is picked from, or the submit row when none. */
interface Item {
	name?: string;
	value: string;
	field?: string;
	custom?: boolean;
}

/**
 * What the user answers a tool call with: each field's options, one of which
 * may be written in, then approve / deny or continue.
 */
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

	const options = useMemo(
		(): Option[] =>
			controls.approval
				? [
						{ label: "approve", approved: true },
						{ label: "deny", approved: false },
					]
				: [{ label: "continue" }],
		[controls.approval],
	);
	const [selected, setSelected] = useState(0);

	const pick = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max(previous + offset, 0), options.length - 1),
			);
		},
		[options.length],
	);

	const groups = useMemo(
		() =>
			controls.fields.length
				? controls.fields.map((field) => ({
						items: [
							...field.options.map(
								(option): Item => ({
									name: option,
									value: option,
									field: field.name,
								}),
							),
							...(field.custom
								? [
										{
											value: `custom:${field.name}`,
											field: field.name,
											custom: true,
										} satisfies Item,
									]
								: []),
						],
					}))
				: [
						{
							items: [
								{
									name: controls.approval ? "Approval" : "Continue",
									value: "submit",
								} satisfies Item,
							],
						},
					],
		[controls],
	);

	const placeholder = useMemo(
		() =>
			Object.fromEntries(
				controls.fields.map((field) => [field.name, field.placeholder]),
			),
		[controls.fields],
	);

	return (
		<Completions<{ items: Item[] }, Item>
			active={isFocused && !locked}
			onPointerDown={() => {
				if (!locked && isNext)
					useEditorStore.setState({ focusedFeedbackId: part.id });
			}}
			groups={groups}
			renderItem={({ item, selected }) => {
				if (item.custom && item.field) {
					const field = item.field;
					return (
						<Textarea
							focus={isFocused && selected && !locked}
							value={values[field] ?? ""}
							onChange={(value) => setValue(field, value)}
							initialLineCount={1}
							autoNewLineLimit={0}
							placeholder={placeholder[field] ?? "something else..."}
						/>
					);
				}
				return item.name;
			}}
			after={
				<Box gap={2}>
					{options.map((option, index) => {
						const active = isFocused && !locked && index === selected;
						return (
							<Text
								key={option.label}
								color={active ? "blue" : "gray"}
								bold={active}
								dimColor={locked}
							>
								{active ? "▶ " : "  "}
								{option.label}
							</Text>
						);
					})}
				</Box>
			}
			onInput={({ item, key, pointer }) => {
				if (locked || !isNext) return false;
				if (pointer) useEditorStore.setState({ focusedFeedbackId: part.id });
				else if (!isFocused) return false;

				// Shift belongs to the text area, which selects its text by it.
				if (key.shift) return false;

				// A press on the write-in field is how the cursor is put into it,
				// and how a selection is started, so it is not taken as a send.
				if (pointer && item?.custom) return false;

				if (key.leftArrow) pick(-1);
				if (key.rightArrow) pick(1);
				if (key.return && item) {
					const answer: Record<string, string> = {};
					if (item.field) {
						answer[item.field] = item.custom
							? (values[item.field] ?? "")
							: item.value;
						if (!answer[item.field]) return;
					}
					// Every field has to have something before it can be sent.
					const complete = controls.fields.every(
						(field) => !!(answer[field.name] ?? values[field.name]),
					);
					if (!complete) {
						if (item.field) setValue(item.field, answer[item.field]);
						return;
					}

					useEditorStore.setState({ focusedFeedbackId: null });
					submit(options[selected].approved, answer);
				}
			}}
			actions={
				options.length > 1 ? [{ key: "←→", name: "pick" }, "select"] : []
			}
			minHeight={4}
		/>
	);
}
