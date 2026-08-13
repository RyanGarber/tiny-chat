import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import { useMemo, useState } from "react";
import DiffLines from "#app/features/code/components/DiffLines.tsx";
import HighlightBody from "#app/features/code/components/HighlightBody.tsx";
import HighlightContent from "#app/features/code/components/HighlightContent.tsx";

export default function Diff({
	before,
	after,
	language,
	filename,
	...props
}: Omit<Parameters<typeof HighlightBody>[0], "code"> & {
	before: string;
	after: string;
}) {
	const [expanded, setExpanded] = useState<number[]>([]);

	const { highlighted: baseHighlight } = useCode({ code: "", language });

	const diff = useMemo(
		() => DiffUtils.context(DiffUtils.diff({ before, after })),
		[before, after],
	);

	return (
		<HighlightBody {...props}>
			<HighlightContent
				code={baseHighlight}
				language={language ?? ""}
				filename={filename}
				lineNumbers={false}
			>
				<DiffLines
					diff={diff}
					expanded={expanded}
					setExpanded={setExpanded}
					language={language ?? ""}
				/>
			</HighlightContent>
		</HighlightBody>
	);
}
