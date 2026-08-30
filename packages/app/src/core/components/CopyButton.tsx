import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	extractTableDataFromElement,
	tableDataToCSV,
	tableDataToMarkdown,
	tableDataToTSV,
} from "streamdown";
import { useClickOutside } from "#app/core/hooks/useClickOutside.ts";

type PromiseOr<T, Params = void> =
	| T
	| ((params: Params) => T)
	| ((_: Params) => Promise<T>);

namespace CopyButton {
	function useCopy<Params = void>(
		source: PromiseOr<ClipboardItems | string, Params>,
		timeout = 2000,
	) {
		const [isCopied, setIsCopied] = useState(false);
		const timeoutRef = useRef(0);

		const copy = useCallback(
			async (params: Params) => {
				if (!navigator?.clipboard?.writeText) {
					console.error("[CopyButton] missing clipboard api");
					return;
				}

				try {
					if (!isCopied) {
						const data =
							typeof source === "function" ? await source(params) : source;
						if (typeof data === "string") {
							await navigator.clipboard.writeText(data);
						} else {
							await navigator.clipboard.write(data);
						}
						setIsCopied(true);
						timeoutRef.current = window.setTimeout(
							() => setIsCopied(false),
							timeout,
						);
					}
				} catch (error) {
					console.error("[CopyButton] failed to copy:", error);
				}
			},
			[isCopied, timeout, source],
		);

		useEffect(() => {
			return () => {
				window.clearTimeout(timeoutRef.current);
			};
		}, []);

		return { copy, isCopied };
	}

	export function Code({
		code,
		streaming,
	}: {
		code: string;
		streaming?: boolean;
	}) {
		const { copy, isCopied } = useCopy(code);

		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					data-streamdown="code-block-copy-button"
					disabled={streaming}
					onClick={() => copy()}
					type="button"
				>
					{isCopied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
				</button>
			</div>
		);
	}

	export function Mermaid({
		chart,
		...props
	}: Omit<Parameters<typeof Code>[0], "code"> & { chart: string }) {
		return <Code code={chart} {...props} />;
	}

	export function Table({ streaming }: { streaming?: boolean }) {
		const { isOpen, setIsOpen, insideRef } = useClickOutside();

		const { copy, isCopied } = useCopy<"md" | "csv" | "tsv">((format) => {
			const tableWrapper = insideRef.current?.closest(
				'[data-streamdown="table-wrapper"]',
			);
			const tableElement = tableWrapper?.querySelector(
				"table",
			) as HTMLTableElement;

			if (!tableElement) {
				throw new Error("missing table");
			}

			const tableData = extractTableDataFromElement(tableElement);

			const formatters = {
				csv: tableDataToCSV,
				tsv: tableDataToTSV,
				md: tableDataToMarkdown,
			};
			const formatter = formatters[format] || tableDataToMarkdown;
			const content = formatter(tableData);

			return [
				new ClipboardItem({
					"text/plain": new Blob([content], { type: "text/plain" }),
					"text/html": new Blob([tableElement.outerHTML], {
						type: "text/html",
					}),
				}),
			];
		});

		return (
			<div className="relative " ref={insideRef}>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					{isCopied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
				</button>
				{isOpen ? (
					<div className="absolute top-full right-0 z-20 mt-1 min-w-30 overflow-hidden rounded-md border border-border bg-background shadow-lg">
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copy("md")}
							type="button"
						>
							MD
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copy("csv")}
							type="button"
						>
							CSV
						</button>
						<button
							className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
							onClick={() => copy("tsv")}
							type="button"
						>
							TSV
						</button>
					</div>
				) : null}
			</div>
		);
	}

	export function Image({
		src,
		streaming,
	}: {
		src: string;
		streaming?: boolean;
	}) {
		const { copy, isCopied } = useCopy(async () => {
			const blob = await (await fetch(src)).blob();
			return [
				new ClipboardItem({
					[blob.type]: blob,
				}),
			];
		});

		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					data-streamdown="code-block-copy-button"
					disabled={streaming}
					onClick={() => copy()}
					type="button"
				>
					{isCopied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
				</button>
			</div>
		);
	}
}

export default CopyButton;
