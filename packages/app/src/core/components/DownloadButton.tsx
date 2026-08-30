import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import {
	extractTableDataFromElement,
	tableDataToCSV,
	tableDataToMarkdown,
} from "streamdown";
import { useClickOutside } from "#app/core/hooks/useClickOutside.ts";
import { ControlUtils } from "#app/core/utils/ControlUtils.ts";
import { useMermaid } from "#app/features/code/hooks/useMermaid.ts";

namespace DownloadButton {
	export function Code({
		code,
		filename,
		streaming,
	}: {
		code: string;
		filename?: string;
		streaming?: boolean;
	}) {
		filename = filename?.split("/").at(-1);
		if (!filename?.includes(".")) filename = "file.txt";
		filename = `${filename.replace(/\.[A-Za-z0-9]+$/, "")}.${FileTypeUtils.getExtension({ name: filename, fallback: "txt" })}`;

		const downloadCode = () => {
			try {
				ControlUtils.download({
					filename,
					content: code,
					mime: "text/plain",
				});
			} catch (error) {
				console.error("[CodeDownloadButton] failed to download:", error);
			}
		};

		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					data-streamdown="code-block-download-button"
					disabled={streaming}
					onClick={downloadCode}
					type="button"
				>
					<DownloadSimpleIcon size={18} />
				</button>
			</div>
		);
	}
	export function Mermaid({
		chart,
		streaming,
	}: {
		chart: string;
		streaming?: boolean;
	}) {
		const { mermaid } = useMermaid();
		const { insideRef, isOpen, setIsOpen } = useClickOutside();

		const downloadMermaid = async (format: "mmd" | "png" | "svg") => {
			try {
				if (format === "mmd") {
					// Download as Mermaid source code
					const filename = "diagram.mmd";
					const mimeType = "text/plain";
					ControlUtils.download({ filename, content: chart, mime: mimeType });
					setIsOpen(false);
					return;
				}

				// Use a stable ID based on chart content hash and timestamp to ensure uniqueness
				const chartHash = chart.split("").reduce((acc, char) => {
					return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
				}, 0);
				const uniqueId = `mermaid-${Math.abs(chartHash)}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

				const { svg } = await mermaid.render(uniqueId, chart);
				// For SVG and PNG, we need to extract the rendered SVG

				if (!svg) {
					return;
				}

				if (format === "svg") {
					const filename = "diagram.svg";
					const mimeType = "image/svg+xml";
					ControlUtils.download({ filename, content: svg, mime: mimeType });
					setIsOpen(false);
					return;
				}

				if (format === "png") {
					const blob = await ControlUtils.rasterize(svg);
					ControlUtils.download({
						filename: "diagram.png",
						content: blob,
						mime: "image/png",
					});
					setIsOpen(false);
					return;
				}
			} catch (error) {
				console.error("[DownloadButton] failed to render:", error);
			}
		};

		return (
			<div className="relative flex" ref={insideRef}>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					<DownloadSimpleIcon size={18} />
				</button>
				{isOpen ? (
					<div className="absolute top-full right-0 z-10 mt-1 min-w-30 overflow-hidden rounded-md border border-border bg-background shadow-lg">
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => downloadMermaid("svg")}
							type="button"
						>
							SVG
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => downloadMermaid("png")}
							type="button"
						>
							PNG
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => downloadMermaid("mmd")}
							type="button"
						>
							Source
						</button>
					</div>
				) : null}
			</div>
		);
	}

	export function Table({ streaming }: { streaming?: boolean }) {
		const { insideRef, isOpen, setIsOpen } = useClickOutside();

		const downloadTableData = (format: "csv" | "markdown") => {
			try {
				const tableWrapper = insideRef.current?.closest(
					'[data-streamdown="table-wrapper"]',
				);
				const tableElement = tableWrapper?.querySelector(
					"table",
				) as HTMLTableElement;

				if (!tableElement) {
					console.error("[DownloadButton] table not found");
					return;
				}

				const tableData = extractTableDataFromElement(tableElement);
				const content =
					format === "csv"
						? tableDataToCSV(tableData)
						: tableDataToMarkdown(tableData);
				const extension = format === "csv" ? "csv" : "md";
				const filename = `table.${extension}`;
				const mimeType = format === "csv" ? "text/csv" : "text/markdown";

				ControlUtils.download({ filename, content, mime: mimeType });
				setIsOpen(false);
			} catch (error) {
				console.error?.("[DownloadButton] failed to download:", error);
			}
		};

		return (
			<div className="relative flex" ref={insideRef}>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					<DownloadSimpleIcon size={18} />
				</button>
				{isOpen ? (
					<div className="absolute top-full right-0 z-20 mt-1 min-w-30 overflow-hidden rounded-md border border-border bg-background shadow-lg">
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => downloadTableData("markdown")}
							type="button"
						>
							MD
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => downloadTableData("csv")}
							type="button"
						>
							CSV
						</button>
					</div>
				) : null}
			</div>
		);
	}

	export function Image({
		src,
		filename,
		streaming,
	}: {
		src: string;
		filename?: string;
		streaming?: boolean;
	}) {
		const downloadImage = async () => {
			try {
				const blob = await (await fetch(src)).blob();
				filename = filename?.split("/").at(-1);
				if (!filename?.includes(".")) filename = "image.webp";
				filename = `${filename.replace(/\.[A-Za-z0-9]+$/, "")}.${FileTypeUtils.getExtension({ name: filename, fallback: "webp" })}`;
				ControlUtils.download({ filename, content: blob, mime: blob.type });
			} catch (error) {
				console.error("[DownloadButton] failed to download image:", error);
			}
		};
		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => downloadImage()}
					type="button"
				>
					<DownloadSimpleIcon size={18} />
				</button>
			</div>
		);
	}
}

export default DownloadButton;
