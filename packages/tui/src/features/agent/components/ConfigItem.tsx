import chalk from "chalk";
import type { CompletionItem } from "#client/features/editor/types/completion.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zModelArg } from "#core/features/provider/types/model.ts";
import Text from "#tui/core/components/Text.tsx";

/**
 * A line of a config menu: a setting showing its value, a checkbox, or —
 * with neither — a requirement, `found` or not.
 */
export interface ConfigItem extends CompletionItem {
	state?: string;
	enabled?: boolean;
	found?: boolean;
	detail?: string;
	disabled?: boolean;
	error?: unknown;
	arg?: zModelArg;
	/** Run by Enter or Space: toggles a checkbox, or opens a setting's choice. */
	onSelect?: () => void;
	/** A page of the item's own settings, opened by `o`. */
	onOpen?: () => void;
}

export default function ConfigItemText({ item }: { item: ConfigItem }) {
	const marker =
		item.state !== undefined ? null : item.enabled !== undefined ? (
			<>
				{chalk.dim("[")}
				<Text color="primary">{item.enabled ? "x" : " "}</Text>
				{chalk.dim("] ")}
			</>
		) : (
			<Text color={item.found ? "primary" : "redBright"}>
				{item.found ? " ✓  " : " ✗  "}
			</Text>
		);

	return (
		<Text
			color={item.error ? "redBright" : undefined}
			dimColor={item.disabled ? true : undefined}
		>
			{marker}
			{item.name}
			{item.state !== undefined && (
				<Text color="textSubtle">{`  ${item.state || chalk.dim("(none)")}`}</Text>
			)}
			{item.onOpen ? chalk.dim(" ›") : ""}
			<Text color={item.error ? "redBright" : "textSubtle"}>
				{item.error ? ` · ${CommonUtils.formatError(item)}` : ""}
				{item.detail ? ` · ${item.detail}` : ""}
			</Text>
		</Text>
	);
}
