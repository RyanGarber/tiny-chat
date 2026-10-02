import { useWindowSize } from "ink";
import _Image, { type ImageProps } from "ink-picture";
import Box from "../../../core/components/Box.tsx";
import Content from "../../../core/components/Content.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";
import { useWidth } from "../../../core/hooks/useWidth.ts";

const AUTO_SIZE = 854902;

export default function Image({
	width = AUTO_SIZE,
	height = AUTO_SIZE,
	center = true,
	backgroundColor,
	...props
}: Omit<ImageProps, "width" | "height"> & {
	width?: number;
	height?: number;
	center?: boolean;
	backgroundColor?: Color;
}) {
	const { rows } = useWindowSize();
	const columns = useWidth();

	if (width === AUTO_SIZE) {
		width = Math.floor(columns / 2);
	}
	if (height === AUTO_SIZE) {
		height = Math.floor(rows / 2);
	}

	const image = (
		<_Image {...props} width={width} height={height} objectFit="contain" />
	);

	// the original image, as the app copies it
	const formatter = async () =>
		typeof props.src === "string"
			? new Uint8Array(await (await fetch(props.src)).arrayBuffer())
			: new Uint8Array(props.src);

	return (
		<Content formatter={formatter} backgroundColor={backgroundColor}>
			{center ? (
				<Box
					flexGrow={1}
					justifyContent="center"
					backgroundColor={backgroundColor}
				>
					{image}
				</Box>
			) : (
				image
			)}
		</Content>
	);
}
