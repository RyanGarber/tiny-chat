import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

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
}

export default CopyButton;
