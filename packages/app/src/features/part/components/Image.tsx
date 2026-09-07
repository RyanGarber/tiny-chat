import { Image as _Image, type ImageProps } from "@mantine/core";
import { type ReactNode, useCallback, useMemo } from "react";
import Content, {
	type ContentFormats,
	type ContentFormatterFunction,
} from "#app/core/components/Content.tsx";

export default function Image({
	src,
	filename,
	streaming,
	withButtons = true,
	grow = false,
	close,
	...props
}: Omit<ImageProps, "src"> & {
	src: string;
	filename?: string;
	streaming?: boolean;
	withButtons?: boolean;
	grow?: boolean;
	close?: ReactNode;
}) {
	const formats = useMemo<ContentFormats>(() => {
		return ["Original"];
	}, []);

	const formatter = useCallback<ContentFormatterFunction>(async () => {
		const blob = await (await fetch(src)).blob();
		return {
			filename,
			mime: blob.type,
			data: blob,
		};
	}, [filename, src]);

	return (
		<Content formats={formats} formatter={formatter}>
			<div
				className="rounded-md border border-border bg-background"
				style={grow ? { height: "100%" } : undefined}
			>
				<_Image
					src={src}
					alt={filename}
					w="100%"
					h={grow ? "100%" : "auto"}
					fit={grow ? "contain" : "scale-down"}
					mx="auto"
					{...props}
				/>
			</div>
		</Content>
	);
}
