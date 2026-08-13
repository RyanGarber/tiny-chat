import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import type { CodeResult } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { type BoxProps as _BoxProps, Box, Text } from "ink";
import { type ReactNode, useContext } from "react";

type BoxProps = { -readonly [T in keyof _BoxProps]: _BoxProps[T] };

export default function Highlight({
	code,
	filename,
	children,
	...props
}: BoxProps & {
	code: CodeResult;
	filename?: string;
	children?: ReactNode;
}) {
	const { colorScheme } = useContext(ThemeContext);

	return (
		<Box
			width="100%"
			paddingX={2}
			paddingY={1}
			flexDirection="column"
			backgroundColor={code.bg}
			{...props}
		>
			{filename && (
				<Box paddingBottom={1}>
					<Text color={colorScheme.textSubtle} wrap="truncate-end">
						{filename}
					</Text>
				</Box>
			)}
			{children}
		</Box>
	);
}
