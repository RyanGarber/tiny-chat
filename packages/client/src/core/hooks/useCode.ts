import {
	type CodeResult,
	CodeUtils,
} from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { useEffect, useMemo, useState } from "react";
import { useThemes } from "../../features/settings/hooks/useThemes.ts";

export const useCode = ({
	code,
	language,
}: {
	code: CodeResult | string;
	language?: string | null;
}) => {
	const { codeTheme } = useThemes();

	const unhighlighted = useMemo(() => {
		if (typeof code !== "string") return code;

		return CodeUtils.unhighlight(code);
	}, [code]);

	const [highlighted, setHighlighted] = useState<CodeResult | null>();

	useEffect(() => {
		if (typeof code !== "string") return;

		CodeUtils.highlight(
			{ code, language: language ?? null, theme: codeTheme },
			(result) => {
				setHighlighted(result);
			},
		);
	}, [code, language, codeTheme]);

	return { highlighted: highlighted ?? unhighlighted };
};
