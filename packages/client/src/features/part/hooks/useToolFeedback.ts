import type { MessageState } from "@tiny-chat/core/features/data/types/message.ts";
import type { zToolCallPart } from "@tiny-chat/core/features/data/types/part.ts";
import type { ToolControls } from "@tiny-chat/core/features/tool/types/display.ts";
import { useCallback, useState } from "react";
import { useStreamStore } from "../../agent/stores/useStreamStore.ts";
import { useMessaging } from "../../chat/hooks/useMessaging.ts";

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

	// A generation waits on its background calls before it ends, and feedback
	// sent meanwhile would resume the message under it.
	const generating = useStreamStore((state) =>
		state.chatAgentStreams.has(message.chatId),
	);

	// Nothing can be sent twice: the controls stay locked from the moment
	// feedback is sent until the result it produces has been saved.
	const locked = sendToolFeedback.isPending || generating;

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
