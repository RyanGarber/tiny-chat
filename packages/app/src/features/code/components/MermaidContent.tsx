/** @author https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/mermaid/index.tsx */

import { Icon } from "@iconify/react";
import { Loader, UnstyledButton } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import Code from "#app/features/code/components/Code.tsx";
import PanZoom from "#app/features/code/components/PanZoom.tsx";
import { useDeferredRender } from "#app/features/code/hooks/useDeferredRenderer.ts";
import { useMermaid } from "#app/features/code/hooks/useMermaid.ts";

export default function MermaidContent({
	chart,
	fullscreen,
}: {
	chart: string;
	fullscreen?: boolean;
}) {
	const { mermaid } = useMermaid();

	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [svgContent, setSvgContent] = useState<string>("");
	const [lastValidSvg, setLastValidSvg] = useState<string>("");
	const [retryCount, setRetryCount] = useState(0);

	const className = useMemo(() => {
		return fullscreen ? " size-full [&_svg]:h-auto [&_svg]:w-auto" : "";
	}, [fullscreen]);

	// Use deferred render hook for optimal performance
	const { shouldRender, containerRef } = useDeferredRender({
		immediate: fullscreen,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: "Required for Mermaid"
	useEffect(() => {
		// Only render when shouldRender is true
		if (!shouldRender) {
			return;
		}

		const renderChart = async () => {
			try {
				setError(null);
				setIsLoading(true);

				// Use a stable ID based on chart content hash and timestamp to ensure uniqueness
				const chartHash = chart.split("").reduce((acc, char) => {
					return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
				}, 0);
				const uniqueId = `mermaid-${Math.abs(chartHash)}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

				const { svg } = await mermaid.render(uniqueId, chart);

				// Update both current and last valid SVG
				setSvgContent(svg);
				setLastValidSvg(svg);
			} catch (err) {
				// Silently fail and keep the last valid SVG
				// Don't update svgContent here - just keep what we have

				// Only set error if we don't have any valid SVG
				if (!(lastValidSvg || svgContent)) {
					const errorMessage =
						err instanceof Error
							? err.message
							: "Failed to render Mermaid chart";
					setError(errorMessage);
				}
			} finally {
				setIsLoading(false);
			}
		};

		void renderChart();
	}, [chart, retryCount, shouldRender]);

	// Show placeholder when not scheduled to render
	if (!(shouldRender || svgContent || lastValidSvg)) {
		return <div className={`my-4 min-h-50${className}`} ref={containerRef} />;
	}

	if (isLoading && !svgContent && !lastValidSvg) {
		return (
			<div
				className={`my-4 flex justify-center p-4${className}`}
				ref={containerRef}
			>
				<div className="flex items-center space-x-2 text-muted-foreground">
					<div className="h-4 w-4 animate-spin rounded-full border-current border-b-2" />
					<Loader size="sm" />
				</div>
			</div>
		);
	}

	// Only show error if we have no valid SVG to display
	if (error && !svgContent && !lastValidSvg) {
		return (
			<div className={`rounded-md p-4${className}`} ref={containerRef}>
				<p className="font-mono text-red-700 text-sm">Mermaid Error: {error}</p>
				<UnstyledButton
					mt={5}
					className="cursor-pointer text-xs"
					onClick={(e) => {
						e.preventDefault();
						setRetryCount(retryCount + 1);
					}}
				>
					<Icon
						icon="lucide:refresh-cw"
						className="mr-1 inline-block"
						width={9}
						height={9}
					/>
					Retry
				</UnstyledButton>
				<details>
					<summary className="cursor-pointer text-xs">Show Code</summary>
					<Code code={chart} language="mermaid" withButtons={false} mt={10} />
				</details>
			</div>
		);
	}

	// Always render the SVG if we have content (either current or last valid)
	const displaySvg = svgContent || lastValidSvg;

	return (
		<div
			className={`size-full${className}`}
			data-streamdown="mermaid"
			ref={containerRef}
		>
			<PanZoom
				className={`overflow-hidden${className}`}
				fullscreen={fullscreen}
				maxZoom={3}
				minZoom={0.5}
				zoomStep={0.1}
			>
				<div
					aria-label="Mermaid chart"
					className={`flex justify-center${fullscreen ? " size-full items-center" : ""}`}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: "Required for Mermaid"
					dangerouslySetInnerHTML={{ __html: displaySvg }}
					role="img"
				/>
			</PanZoom>
		</div>
	);
}
