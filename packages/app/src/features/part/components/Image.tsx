import { Image as _Image, type ImageProps } from "@mantine/core";
import type { ReactNode } from "react";
import CopyButton from "#app/core/components/CopyButton.tsx";
import DownloadButton from "#app/core/components/DownloadButton.tsx";
import FullscreenButton from "#app/core/components/FullscreenButton.tsx";

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
	return (
		<div
			className="relative"
			data-streamdown="table-wrapper"
			style={grow ? { height: "100%" } : undefined}
		>
			{withButtons ? (
				<div className="absolute top-2 right-2 z-10 flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur">
					<CopyButton.Image src={src} streaming={streaming} />
					<DownloadButton.Image
						src={src}
						filename={filename}
						streaming={streaming}
					/>
					{close ?? (
						<FullscreenButton.Image
							src={src}
							filename={filename}
							streaming={streaming}
						/>
					)}
				</div>
			) : null}
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
		</div>
	);
}
