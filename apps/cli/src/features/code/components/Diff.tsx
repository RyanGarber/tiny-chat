/** biome-ignore-all lint/suspicious/noArrayIndexKey: nodes stay in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import { Text } from "ink";
import { useMemo } from "react";
import { CliUtils } from "../../../core/utils/CliUtils.ts";
import DiffLines from "./DiffLines.tsx";
import Highlight from "./Highlight.tsx";

export default function Diff({
	before,
	after,
	language,
	maxHeight,
	...props
}: Omit<Parameters<typeof Highlight>[0], "code"> & {
	before: string;
	after: string;
	language?: string | null;
	maxHeight?: number;
}) {
	// every line is drawn behind a two column marker, so tab stops start there
	const diff = useMemo(
		() =>
			DiffUtils.context(
				DiffUtils.diff({
					before: CliUtils.display(before, 2),
					after: CliUtils.display(after, 2),
				}),
			),
		[before, after],
	);

	const diffShown = useMemo(() => diff.slice(0, maxHeight), [diff, maxHeight]);
	const overflow = diff.length - diffShown.length;

	const { highlighted } = useCode({ code: "", language });

	return (
		<Highlight code={highlighted} {...props}>
			<DiffLines
				diff={diffShown}
				highlighted={highlighted}
				language={language}
			/>
			{overflow > 0 && <Text dimColor>{` ⋮ ${overflow} more lines`}</Text>}
		</Highlight>
	);
}
