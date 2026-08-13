import { Box, type BoxProps, Loader } from "@mantine/core";
import type { CodeLanguage } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { type ReactNode, Suspense } from "react";
import CopyButton from "#app/features/code/components/CopyButton.tsx";
import DownloadButton from "#app/features/code/components/DownloadButton.tsx";
import FullscreenButton from "#app/features/code/components/FullscreenButton.tsx";

export default function HighlightBody({
	code,
	chart,
	language,
	filename,
	streaming,
	style,
	withButtons = true,
	children,
	...props
}: BoxProps & {
	code?: string;
	chart?: string;
	language?: CodeLanguage | "text";
	filename?: string;
	streaming?: boolean;
	withButtons?: boolean;
	children?: ReactNode;
}) {
	return (
		<Suspense
			fallback={
				<div className="w-full divide-y divide-border overflow-hidden rounded-xl border">
					<div className="h-11.5 w-full bg-muted/80" />
					<div className="flex w-full items-center justify-center p-4">
						<Loader size="sm" />
					</div>
				</div>
			}
		>
			<Box
				className="relative"
				data-streamdown={
					code ? "code-block" : chart ? "mermaid-block" : undefined
				}
				data-language={language}
				data-incomplete={streaming}
				style={{
					contentVisibility: "auto",
					containIntrinsicSize: "auto 200px",
					...style,
				}}
				{...props}
			>
				{code && withButtons && (
					<div
						className="absolute top-2 right-2 z-10 flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur"
						data-streamdown="code-block-actions"
					>
						<CopyButton.Code code={code} streaming={streaming} />
						<DownloadButton.Code
							code={code}
							filename={filename}
							streaming={streaming}
						/>
					</div>
				)}
				{chart && withButtons && (
					<div
						className="absolute top-2 right-2 z-10 flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur"
						data-streamdown="mermaid-block-actions"
					>
						<DownloadButton.Mermaid chart={chart} streaming={streaming} />
						<CopyButton.Mermaid chart={chart} streaming={streaming} />
						<FullscreenButton.Mermaid chart={chart} streaming={streaming} />
					</div>
				)}
				{children}
			</Box>
		</Suspense>
	);
}
