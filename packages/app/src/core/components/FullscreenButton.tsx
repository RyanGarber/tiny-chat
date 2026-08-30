import { Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { FrameCornersIcon, XIcon } from "@phosphor-icons/react";
import type { CodeLanguage } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CopyButton from "#app/core/components/CopyButton.tsx";
import DownloadButton from "#app/core/components/DownloadButton.tsx";
import { ControlUtils } from "#app/core/utils/ControlUtils.ts";
import _Code from "#app/features/code/components/Code.tsx";
import MermaidContent from "#app/features/code/components/MermaidContent.tsx";
import _Image from "#app/features/part/components/Image.tsx";

namespace FullscreenButton {
	export function Code({
		code,
		language,
		filename,
		streaming,
	}: {
		code: string;
		language?: "text" | CodeLanguage;
		filename?: string;
		streaming?: boolean;
	}) {
		const [opened, { open, close }] = useDisclosure();

		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={open}
					type="button"
				>
					<FrameCornersIcon size={18} />
				</button>
				{opened && (
					<Modal
						opened={opened}
						onClose={close}
						fullScreen={true}
						withCloseButton={false}
						styles={{ body: { height: "100%" } }}
					>
						<_Code
							code={code}
							language={language}
							filename={filename}
							streaming={streaming}
							fillHeight
							flex={1}
							h="100%"
							close={
								<div className="relative flex">
									<button
										className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
										onClick={close}
										type="button"
									>
										<XIcon size={18} />
									</button>
								</div>
							}
						/>
					</Modal>
				)}
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
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={handleToggle}
					type="button"
				>
					<FrameCornersIcon size={18} />
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
									<div className="relative flex">
										<button
											className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
											onClick={handleToggle}
											type="button"
										>
											<XIcon size={18} />
										</button>
									</div>
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
			</div>
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
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={handleOpen}
					type="button"
				>
					<FrameCornersIcon size={18} />
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
										<div className="relative flex">
											<button
												className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
												onClick={handleClose}
												type="button"
											>
												<XIcon size={18} />
											</button>
										</div>
									</div>
									<div className="flex-1 overflow-auto p-4 pt-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
										<table
											className="w-full *:divide-none [&_th]:first:ps-6 [&_th]:last:pe-6 [&_td]:first:ps-6 [&_td]:last:pe-6 [&_th]:py-3 [&_td]:py-4"
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
		const [opened, { open, close }] = useDisclosure();

		return (
			<div className="relative flex">
				<button
					className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
					disabled={streaming}
					onClick={open}
					type="button"
				>
					<FrameCornersIcon size={18} />
				</button>
				{opened && (
					<Modal
						opened={opened}
						onClose={close}
						fullScreen={true}
						withCloseButton={false}
						styles={{ body: { height: "100%" } }}
					>
						<_Image
							src={src}
							filename={filename}
							streaming={streaming}
							grow
							close={
								<div className="relative flex">
									<button
										className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
										onClick={close}
										type="button"
									>
										<XIcon size={18} />
									</button>
								</div>
							}
						/>
					</Modal>
				)}
			</div>
		);
	}
}

export default FullscreenButton;
