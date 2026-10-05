import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolControls } from "@tiny-chat/core/features/tool/types/display.ts";
import { useCallback, useState } from "react";
import { useStreamStore } from "../../agent/stores/useStreamStore.ts";
import { useMessaging } from "../../chat/hooks/useMessaging.ts";
import { useToolFeedbackStore } from "../stores/useToolFeedbackStore.ts";

/**
 * The state behind a tool call's controls: what the user has filled in, and
 * sending it. Fields are sent as one object keyed by each field's `name`.
 */
export const useToolFeedback = ({
	message,
	part,
	controls,
}: {
	message: MessageState;
	part: zToolCallPart;
	controls: ToolControls;
}) => {
	const { sendToolFeedback } = useMessaging();

	const [values, setValues] = useState<Record<string, string>>({});

	const setValue = useCallback((name: string, value: string) => {
		setValues((previous) => ({ ...previous, [name]: value }));
	}, []);

	// A running generation takes an answer only while it is waiting on one;
	// otherwise it is busy with the model, or ending.
	const generating = useStreamStore((state) =>
		state.chatAgentStreams.has(message.chatId),
	);
	const awaiting = useToolFeedbackStore((state) => state.awaiting.has(part.id));
	const answered = useToolFeedbackStore((state) => state.answered.has(part.id));

	// Nothing can be sent twice: the controls stay locked from the moment
	// feedback is sent until the call it answers has settled.
	const locked =
		sendToolFeedback.isPending || answered || (generating && !awaiting);

	const complete = controls.fields.every((field) => !!values[field.name]);

	const submit = useCallback(
		(approved?: boolean, overrides?: Record<string, string>) => {
			const feedback = { ...values, ...overrides };
			sendToolFeedback.mutate({
				seed: message,
				part,
				approved: controls.approval ? approved : undefined,
				feedback: controls.fields.length ? feedback : undefined,
			});
		},
		[values, message, part, controls, sendToolFeedback],
	);

	return {
		values,
		setValue,
		submit,
		locked,
		complete,
		mutation: sendToolFeedback,
		/** Which choice is being sent, for a spinner on the right button. */
		sending: sendToolFeedback.isPending
			? (sendToolFeedback.variables?.approved ?? true)
			: undefined,
	};
};
