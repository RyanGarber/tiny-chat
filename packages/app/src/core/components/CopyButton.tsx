import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import {
	extractTableDataFromElement,
	tableDataToCSV,
	tableDataToMarkdown,
	tableDataToTSV,
} from "streamdown";
import { useClickOutside } from "#app/core/hooks/useClickOutside.ts";

namespace CopyButton {
	export function Code({
		code,
		streaming,
		timeout = 2000,
	}: {
		code: string;
		streaming?: boolean;
		timeout?: number;
	}) {
		const [isCopied, setIsCopied] = useState(false);
		const timeoutRef = useRef(0);

		const copyToClipboard = async () => {
			if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
				console.error("[CodeCopyButton] missing clipboard api");
				return;
			}

			try {
				if (!isCopied) {
					await navigator.clipboard.writeText(code);
					setIsCopied(true);
					timeoutRef.current = window.setTimeout(
						() => setIsCopied(false),
						timeout,
					);
				}
			} catch (error) {
				console.error("[CodeCopyButton] failed to copy:", error);
			}
		};

		useEffect(() => {
			return () => {
				window.clearTimeout(timeoutRef.current);
			};
		}, []);

		return (
			<button
				className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
				data-streamdown="code-block-copy-button"
				disabled={streaming}
				onClick={copyToClipboard}
				type="button"
			>
				<Icon
					icon={isCopied ? "lucide:check" : "lucide:copy"}
					width={16}
					height={16}
				/>
			</button>
		);
	}

	export function Mermaid({
		chart,
		...props
	}: Omit<Parameters<typeof Code>[0], "code"> & { chart: string }) {
		return <Code code={chart} {...props} />;
	}

	export function Table({
		timeout = 2000,
		streaming,
	}: {
		timeout?: number;
		streaming?: boolean;
	}) {
		const { isOpen, setIsOpen, insideRef } = useClickOutside();
		const [isCopied, setIsCopied] = useState(false);
		const timeoutRef = useRef(0);

		const copyTableData = async (format: "csv" | "tsv" | "md") => {
			if (typeof window === "undefined" || !navigator?.clipboard?.write) {
				console.error("[CopyButton] missing clipboard api");
				return;
			}

			try {
				const tableWrapper = insideRef.current?.closest(
					'[data-streamdown="table-wrapper"]',
				);
				const tableElement = tableWrapper?.querySelector(
					"table",
				) as HTMLTableElement;

				if (!tableElement) {
					console.error("[CopyButton] table not found");
					return;
				}

				const tableData = extractTableDataFromElement(tableElement);

				const formatters = {
					csv: tableDataToCSV,
					tsv: tableDataToTSV,
					md: tableDataToMarkdown,
				};
				const formatter = formatters[format] || tableDataToMarkdown;
				const content = formatter(tableData);

				const clipboardItemData = new ClipboardItem({
					"text/plain": new Blob([content], { type: "text/plain" }),
					"text/html": new Blob([tableElement.outerHTML], {
						type: "text/html",
					}),
				});

				await navigator.clipboard.write([clipboardItemData]);
				setIsCopied(true);
				setIsOpen(false);
				timeoutRef.current = window.setTimeout(
					() => setIsCopied(false),
					timeout,
				);
			} catch (error) {
				console.error("[CopyButton] failed to copy:", error);
			}
		};

		return (
			<div className="relative" ref={insideRef}>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					<Icon icon={isCopied ? "lucide:check" : "lucide:copy"} />
				</button>
				{isOpen ? (
					<div className="absolute top-full right-0 z-20 mt-1 min-w-30 overflow-hidden rounded-md border border-border bg-background shadow-lg">
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copyTableData("md")}
							type="button"
						>
							MD
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copyTableData("csv")}
							type="button"
						>
							CSV
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copyTableData("tsv")}
							type="button"
						>
							TSV
						</button>
					</div>
				) : null}
			</div>
		);
	}
}

export default CopyButton;
