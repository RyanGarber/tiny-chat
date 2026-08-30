import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import CodeLines from "#app/features/code/components/CodeLines.tsx";
import HighlightBody from "#app/features/code/components/HighlightBody.tsx";
import HighlightContent from "#app/features/code/components/HighlightContent.tsx";

export default function Code({
	code,
	language,
	filename,
	startLine = 1,
	lineNumbers = true,
	streaming,
	fillHeight = false,
	...props
}: Omit<Parameters<typeof HighlightBody>[0], "code"> & {
	code: string;
	startLine?: number;
	lineNumbers?: boolean;
	streaming?: boolean;
	fillHeight?: boolean;
}) {
	const { highlighted } = useCode({ code, language });

	return (
		<HighlightBody
			code={code}
			highlight={highlighted}
			language={language}
			streaming={streaming}
			filename={filename}
			h={fillHeight ? "100%" : undefined}
			{...props}
		>
			<HighlightContent
				language={language ?? ""}
				filename={filename}
				lineNumbers={lineNumbers}
				startLine={startLine}
				highlight={highlighted}
				fillHeight={fillHeight}
			>
				<CodeLines
					code={highlighted}
					language={language}
					lineNumbers={lineNumbers}
				/>
			</HighlightContent>
		</HighlightBody>
	);
}
