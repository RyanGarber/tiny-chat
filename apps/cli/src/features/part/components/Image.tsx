import { useWindowSize } from "ink";
import _Image, { type ImageProps } from "ink-picture";
import Box from "../../../core/components/Box.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";

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
	const { columns, rows } = useWindowSize();

	if (width === AUTO_SIZE) {
		width = Math.floor(columns / 2);
	}
	if (height === AUTO_SIZE) {
		height = Math.floor(rows / 2);
	}

	const image = (
		<_Image {...props} width={width} height={height} objectFit="contain" />
	);

	if (center) {
		return (
			<Box
				flexGrow={1}
				justifyContent="center"
				backgroundColor={backgroundColor}
			>
				{image}
			</Box>
		);
	}

	return image;
}
