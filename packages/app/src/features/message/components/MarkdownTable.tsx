import type { ComponentProps } from "react";
import CopyButton from "#app/core/components/CopyButton.tsx";
import DownloadButton from "#app/core/components/DownloadButton.tsx";
import FullscreenButton from "#app/core/components/FullscreenButton.tsx";

export const Table = ({
	children,
	className,
	withButtons,
	streaming,
	...props
}: ComponentProps<"table"> & {
	with?: boolean;
	withButtons?: boolean;
	streaming?: boolean;
}) => {
	return (
		<div className="relative" data-streamdown="table-wrapper">
			{withButtons ? (
				<div className="absolute top-2 right-2 z-10 flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur">
					<CopyButton.Table streaming={streaming} />
					<DownloadButton.Table streaming={streaming} />
					<FullscreenButton.Table streaming={streaming}>
						{children}
					</FullscreenButton.Table>
				</div>
			) : null}
			<div className="border-collapse overflow-x-auto overflow-y-auto rounded-md border border-border bg-background">
				<table
					className="w-full *:divide-none [&_th]:first:ps-6 [&_th]:last:pe-6 [&_td]:first:ps-6 [&_td]:last:pe-6 [&_th]:py-3 [&_td]:py-4"
					data-streamdown="table"
					{...props}
				>
					{children}
				</table>
			</div>
		</div>
	);
};
