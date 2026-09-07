import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import { useCallback, useMemo, useState } from "react";
import Content, {
	type ContentFormats,
	type ContentFormatterFunction,
} from "#app/core/components/Content.tsx";
import DiffLines from "#app/features/code/components/DiffLines.tsx";
import Highlight from "#app/features/code/components/Highlight.tsx";

export default function Diff({
	before,
	after,
	language,
	filename,
	...props
}: Omit<Parameters<typeof Content>[0], "code"> & {
	before: string;
	after: string;
	language?: string;
	filename?: string;
}) {
	const [expanded, setExpanded] = useState<number[]>([]);

	const { highlighted: baseHighlight } = useCode({ code: "", language });

	const diff = useMemo(
		() => DiffUtils.context(DiffUtils.diff({ before, after })),
		[before, after],
	);

	const formats = useMemo<ContentFormats>(() => {
		return ["Before", "After"];
	}, []);

	const formatter = useCallback<ContentFormatterFunction>(
		async (format) => {
			return {
				filename,
				mime: "text/plain",
				data: format === "Before" ? before : after,
			};
		},
		[before, after, filename],
	);

	return (
		<Content formats={formats} formatter={formatter} {...props}>
			<Highlight
				highlight={baseHighlight}
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
			</Highlight>
		</Content>
	);
}
