import { useDisclosure } from "@mantine/hooks";
import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { useCallback, useMemo } from "react";
import Content, {
	type ContentFormatterFunction,
} from "#app/core/components/Content.tsx";
import CodeLines from "#app/features/code/components/CodeLines.tsx";
import Highlight from "#app/features/code/components/Highlight.tsx";

export default function Code({
	code,
	language,
	filename,
	startLine = 1,
	lineNumbers = true,
	streaming,
	fillHeight = false,
	...props
}: Parameters<typeof Content>[0] & {
	code: string;
	language?: string;
	filename?: string;
	startLine?: number;
	lineNumbers?: boolean;
	streaming?: boolean;
	fillHeight?: boolean;
}) {
	const { highlighted } = useCode({ code, language });

	const disclosure = useDisclosure();

	const formats = useMemo(() => {
		return ["Original"];
	}, []);

	const formatter = useCallback<ContentFormatterFunction>(async () => {
		return {
			filename,
			mime: "text/plain",
			data: code,
		};
	}, [code, filename]);

	return (
		<Content
			formats={formats}
			formatter={formatter}
			streaming={streaming}
			data-streamdown="code-block"
			data-language={language}
			data-incomplete={streaming}
			disclosure={disclosure}
			{...props}
		>
			<Highlight
				language={language ?? ""}
				filename={filename}
				lineNumbers={lineNumbers}
				startLine={startLine}
				highlight={highlighted}
				fillHeight={fillHeight || disclosure[0]}
			>
				<CodeLines
					code={highlighted}
					language={language}
					lineNumbers={lineNumbers}
				/>
			</Highlight>
		</Content>
	);
}
