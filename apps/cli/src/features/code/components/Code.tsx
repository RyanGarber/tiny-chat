/** biome-ignore-all lint/suspicious/noArrayIndexKey: nodes stay in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { Text } from "ink";
import { useMemo } from "react";
import { CliUtils } from "../../../core/utils/CliUtils.ts";
import { CodeLines } from "./CodeLines.tsx";
import Highlight from "./Highlight.tsx";

export const Code = ({
	code,
	filename,
	language,
	startLine = 1,
	lineNumbers = true,
	maxHeight,
	...props
}: Omit<Parameters<typeof Highlight>[0], "code"> & {
	code: string;
	filename?: string;
	language?: string | null;
	startLine?: number;
	lineNumbers?: boolean;
	maxHeight?: number;
}) => {
	const codeShown = code.slice(0, maxHeight);
	const overflow = code.length - codeShown.length;

	// tabs are expanded before highlighting so the tokens Ink measures are the
	// same width the terminal draws
	const displayed = useMemo(() => CliUtils.display(code), [code]);

	const { highlighted } = useCode({
		code: displayed,
		language: language ?? null,
	});

	return (
		<Highlight code={highlighted} filename={filename} {...props}>
			<CodeLines code={highlighted} language={language} />
			{overflow > 0 && <Text dimColor>{` ⋮ ${overflow} more lines`}</Text>}
		</Highlight>
	);
};
