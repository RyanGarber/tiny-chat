import { Icon } from "@iconify/react";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { useEffect, useRef, useState } from "react";
import { useMermaid } from "#app/features/code/hooks/useMermaid.ts";
import { HighlightUtils } from "#app/features/code/utils/HighlightUtils.ts";

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
		if (!filename?.includes(".")) filename = "file.txt";
		filename = `${filename.replace(/\.[A-Za-z0-9]+$/, "")}.${FileTypeUtils.getExtension({ name: filename, fallback: "txt" })}`;

		const downloadCode = () => {
			try {
				HighlightUtils.download({
					filename,
					content: code,
					mime: "text/plain",
				});
			} catch (error) {
				console.error("[CodeDownloadButton] failed to download:", error);
			}
		};

		return (
			<button
				className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
				data-streamdown="code-block-download-button"
				disabled={streaming}
				onClick={downloadCode}
				type="button"
			>
				<Icon icon="lucide:download" width={16} height={16} />
			</button>
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

		const [isOpen, setIsOpen] = useState(false);
		const dropdownRef = useRef<HTMLDivElement>(null);

		const downloadMermaid = async (format: "mmd" | "png" | "svg") => {
			try {
				if (format === "mmd") {
					// Download as Mermaid source code
					const filename = "diagram.mmd";
					const mimeType = "text/plain";
					HighlightUtils.download({ filename, content: chart, mime: mimeType });
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
					HighlightUtils.download({ filename, content: svg, mime: mimeType });
					setIsOpen(false);
					return;
				}

				if (format === "png") {
					const blob = await HighlightUtils.rasterize(svg);
					HighlightUtils.download({
						filename: "diagram.png",
						content: blob,
						mime: "image/png",
					});
					setIsOpen(false);
					return;
				}
			} catch (error) {
				console.error("[MermaidDownload] failed to render:", error);
			}
		};

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				const path = event.composedPath();
				if (dropdownRef.current && !path.includes(dropdownRef.current)) {
					setIsOpen(false);
				}
			};

			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}, []);

		return (
			<div className="relative" ref={dropdownRef}>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					<Icon icon="lucide:download" />
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
}

export default DownloadButton;
