import type { ReactNode } from "react";
import type { Color } from "../hooks/useColor.ts";
import { ClipboardService } from "../services/ClipboardService.ts";
import Box from "./Box.tsx";
import Button from "./Button.tsx";

/** Text is copied as is; bytes are copied as an encoded image. */
type ContentFormatted = string | Uint8Array;

export type ContentFormatter = () =>
	| ContentFormatted
	| Promise<ContentFormatted>;

/**
 * Wraps a block of content (code, a table, an image, …) with a `[copy]`
 * button in its top right corner.
 *
 * The app offers every format to copy or download; here only the block's first
 * format is copied, so `formatter` produces just that one.
 */
export default function Content({
	formatter,
	streaming,
	backgroundColor,
	children,
}: {
	formatter?: ContentFormatter;
	/** The content is still coming in, so there is nothing whole to copy. */
	streaming?: boolean;
	/** Behind the button: text drawn over a block does not keep its color. */
	backgroundColor?: Color;
	children?: ReactNode;
}) {
	const copy = async () => {
		if (!formatter) return;
		try {
			const formatted = await formatter();
			if (typeof formatted === "string") ClipboardService.copy(formatted);
			else ClipboardService.copyImage(formatted);
		} catch (error) {
			console.warn("[Content] failed to copy", error);
		}
	};

	return (
		<Box flexDirection="column" width="100%">
			{children}
			{formatter && !streaming && (
				<Box
					position="absolute"
					top={0}
					right={2}
					backgroundColor={backgroundColor}
				>
					<Button label="copy" labelOnClick="copied" onClick={copy} />
				</Box>
			)}
		</Box>
	);
}
