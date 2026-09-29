import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/features/editor/types/completion.ts";
import { type ReactNode, useState } from "react";
import Text from "../../../core/components/Text.tsx";
import Completions from "../../editor/components/Completions.tsx";

export interface ChoiceItem extends CompletionItem {
	detail?: string;
}

/**
 * A submenu that picks one of its items — or toggles them, when `renderItem`
 * marks their state — and starts on the one already in effect.
 */
export default function Choice<T extends ChoiceItem>({
	groups,
	onSelect,
	onClear,
	onKey,
	renderItem,
	before,
	actions = [],
}: {
	groups: CompletionGroup<T>[];
	onSelect: (item: T) => void;
	/** Puts the setting back to unset, on `d`. */
	onClear?: () => void;
	/** First look at any other key, given the item under the cursor. */
	onKey?: (_: { item: T; input: string }) => boolean | undefined;
	renderItem?: (item: T) => ReactNode;
	before?: ReactNode;
	actions?: { key: string; name: string }[];
}) {
	// The cursor starts on the item in effect, and is the user's after that.
	const [selected, setSelected] = useState(() =>
		Math.max(
			0,
			groups.flatMap((group) => group.items).findIndex((i) => i.active),
		),
	);

	return (
		<Completions<CompletionGroup<T>, T>
			groups={groups}
			selected={selected}
			setSelected={setSelected}
			selectFirstOnChange={false}
			before={before}
			onInput={({ item, key, input }) => {
				if (!item) return;
				if (key.return) {
					onSelect(item);
					return true;
				}
				if (onClear && input === "d") {
					onClear();
					return true;
				}
				return onKey?.({ item, input });
			}}
			renderItem={({ item }) =>
				renderItem?.(item) ?? (
					<>
						<Text>{item.name}</Text>
						{item.detail && <Text color="textSubtle">{item.detail}</Text>}
					</>
				)
			}
			renderEmpty={() => "nothing to choose from"}
			actions={[
				"select",
				...(onClear ? [{ key: "d", name: "clear" }] : []),
				...actions,
				"back",
			]}
		/>
	);
}
