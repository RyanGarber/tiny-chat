import { Icon } from "@iconify/react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CopyButton from "#app/core/components/CopyButton.tsx";
import DownloadButton from "#app/core/components/DownloadButton.tsx";
import { ControlUtils } from "#app/core/utils/ControlUtils.ts";
import MermaidContent from "#app/features/code/components/MermaidContent.tsx";

namespace FullscreenButton {
	export function Mermaid({
		chart,
		streaming,
	}: {
		chart: string;
		streaming?: boolean;
	}) {
		const [isFullscreen, setIsFullscreen] = useState(false);

		const handleToggle = () => {
			setIsFullscreen(!isFullscreen);
		};

		// Manage scroll lock and keyboard events
		useEffect(() => {
			if (isFullscreen) {
				ControlUtils.lockScroll();

				const handleEsc = (e: KeyboardEvent) => {
					if (e.key === "Escape") {
						setIsFullscreen(false);
					}
				};

				document.addEventListener("keydown", handleEsc);
				return () => {
					document.removeEventListener("keydown", handleEsc);
					ControlUtils.unlockScroll();
				};
			}
		}, [isFullscreen]);

		return (
			<>
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={handleToggle}
					type="button"
				>
					<Icon icon="lucide:maximize" width={16} height={16} />
				</button>

				{isFullscreen
					? createPortal(
							<div
								aria-modal="true"
								className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
								data-streamdown="mermaid-fullscreen"
								onClick={handleToggle}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										handleToggle();
									}
								}}
								role="dialog"
							>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: "div with role=presentation is used for event propagation control" */}
								<div
									className="absolute top-4 right-4 z-10 flex items-center gap-1"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
									role="presentation"
								>
									<DownloadButton.Mermaid chart={chart} streaming={streaming} />
									<CopyButton.Mermaid chart={chart} streaming={streaming} />
									<button
										className="rounded-md p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
										onClick={handleToggle}
										type="button"
									>
										<Icon icon="lucide:x" width={16} height={16} />
									</button>
								</div>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: "div with role=presentation is used for event propagation control" */}
								<div
									className="flex size-full items-center justify-center p-4"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<MermaidContent chart={chart} fullscreen={true} />
								</div>
							</div>,
							document.body,
						)
					: null}
			</>
		);
	}

	export function Table({
		children,
		streaming,
	}: {
		children: ReactNode;
		streaming?: boolean;
	}) {
		const [isFullscreen, setIsFullscreen] = useState(false);

		const handleOpen = () => {
			setIsFullscreen(true);
		};

		const handleClose = () => {
			setIsFullscreen(false);
		};

		useEffect(() => {
			if (isFullscreen) {
				ControlUtils.lockScroll();

				const handleEsc = (e: KeyboardEvent) => {
					if (e.key === "Escape") {
						setIsFullscreen(false);
					}
				};

				document.addEventListener("keydown", handleEsc);
				return () => {
					document.removeEventListener("keydown", handleEsc);
					ControlUtils.unlockScroll();
				};
			}
		}, [isFullscreen]);

		return (
			<>
				<button
					className="p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
					disabled={streaming}
					onClick={handleOpen}
					type="button"
				>
					<Icon icon="lucide:maximize" />
				</button>

				{isFullscreen
					? createPortal(
							<div
								className="fixed inset-0 z-50 flex flex-col bg-background"
								data-streamdown="table-fullscreen"
								onClick={handleClose}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										handleClose();
									}
								}}
								role="dialog"
							>
								{/** biome-ignore lint/a11y/noStaticElementInteractions: necessary */}
								<div
									className="flex h-full flex-col"
									data-streamdown="table-wrapper"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<div className="flex items-center justify-end gap-1 p-4">
										<CopyButton.Table />
										<DownloadButton.Table />
										<button
											className="rounded-md p-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
											onClick={handleClose}
											type="button"
										>
											<Icon icon="lucide:x" />
										</button>
									</div>
									<div className="flex-1 overflow-auto p-4 pt-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
										<table
											className="w-full border-collapse border border-border"
											data-streamdown="table"
										>
											{children}
										</table>
									</div>
								</div>
							</div>,
							document.body,
						)
					: null}
			</>
		);
	}
}

export default FullscreenButton;
