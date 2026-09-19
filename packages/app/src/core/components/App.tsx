import { AppShell, Box, LoadingOverlay, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { useDrag } from "@use-gesture/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Background from "#app/core/components/Background.tsx";
import Console from "#app/core/components/Console.tsx";
import Tauri from "#app/core/components/Tauri.tsx";
import { useExperiments } from "#app/core/hooks/useExperiments.tsx";
import { useViewport } from "#app/core/hooks/useViewport.ts";
import { AppService } from "#app/core/services/AppService.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import Chat from "#app/features/chat/components/Chat.tsx";
import ChatFiles from "#app/features/chat/components/ChatFiles.tsx";
import Sidebar from "#app/features/sidebar/components/Sidebar.tsx";
import mantineTheme, { cssResolver } from "#app/theme.tsx";
import { useSession } from "#client/src/core/hooks/useSession.ts";
import { useThemes } from "../../../../client/src/features/settings/hooks/useThemes.ts";
import { setHashbangQuery, useHashbang } from "../hooks/useHashbang";

export default function App() {
	const { query } = useHashbang();
	const { session } = useSession({
		token: {
			value: query.token ? decodeURIComponent(query.token) : undefined,
			onChange: () => setHashbangQuery({ token: undefined }),
		},
		clone: {
			value: query.clone ? decodeURIComponent(query.clone) : undefined,
			onChange: () => setHashbangQuery({ clone: undefined }),
		},
	});
	useExperiments();
	const { height: viewportHeight, containerRef } = useViewport();
	const { theme } = useThemes();

	const isMobile = useAppStore((s) => s.isMobile);
	const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
	const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
	const isAsideOpen = useAppStore((s) => s.isAsideOpen);
	const setAsideOpen = useAppStore((s) => s.setAsideOpen);
	const asideWidth = useAppStore((s) => s.asideWidth);
	const setAsideWidth = useAppStore((s) => s.setAsideWidth);
	const [isResizingSidebar, setIsResizingSidebar] = useState(false);
	const [isResizingAside, setIsResizingAside] = useState(false);
	const appShellRef = useRef<HTMLDivElement>(null);
	const sidebarResizeHandleRef = useRef<HTMLDivElement>(null);
	const asideResizeHandleRef = useRef<HTMLDivElement>(null);
	const sidebarContentRef = useRef<HTMLDivElement>(null);
	const asideContentRef = useRef<HTMLDivElement>(null);

	useEffect(() => AppService.initialize(), []);

	const dragSidebarResize = useDrag(
		({ first, last, xy: [pointerX] }) => {
			if (first) {
				setIsResizingSidebar(true);
				setSidebarOpen(true);
			}
			const closedWidth = isMobile ? 0 : 60;
			const width = Math.min(300, Math.max(closedWidth, pointerX));
			const expandedOpacity = Math.max(
				0,
				(width - closedWidth) / (300 - closedWidth),
			);
			if (sidebarContentRef.current && isMobile) {
				sidebarContentRef.current.style.opacity = `${Math.max(
					0,
					expandedOpacity,
				)}`;
			}
			if (sidebarResizeHandleRef.current)
				sidebarResizeHandleRef.current.style.left = `${width - 7}px`;
			if (appShellRef.current) {
				appShellRef.current.style.setProperty(
					"--app-shell-navbar-width",
					`${width}px`,
				);
				if (!isMobile)
					appShellRef.current.style.setProperty(
						"--app-shell-navbar-offset",
						`${width}px`,
					);
				if (!isMobile) {
					appShellRef.current.style.setProperty(
						"--sidebar-expanded-opacity",
						`${expandedOpacity}`,
					);
					appShellRef.current.style.setProperty(
						"--sidebar-collapsed-opacity",
						`${1 - expandedOpacity}`,
					);
					appShellRef.current.style.setProperty(
						"--sidebar-expanded-visibility",
						"visible",
					);
					appShellRef.current.style.setProperty(
						"--sidebar-collapsed-visibility",
						"visible",
					);
					appShellRef.current.style.setProperty(
						"--sidebar-opacity-transition",
						"none",
					);
				}
			}

			if (last) {
				setSidebarOpen(width > 150);
				setIsResizingSidebar(false);
			}
		},
		{ axis: "x", filterTaps: true },
	);
	const dragAsideResize = useDrag(
		({ first, last, xy: [pointerX] }) => {
			if (first) {
				setIsResizingAside(true);
				setAsideOpen(true);
			}
			const width = Math.min(
				window.innerWidth,
				Math.max(0, window.innerWidth - pointerX),
			);
			if (asideContentRef.current)
				asideContentRef.current.style.opacity = `${Math.min(1, width / 300)}`;
			if (asideResizeHandleRef.current)
				asideResizeHandleRef.current.style.right = `${width - 7}px`;
			if (appShellRef.current) {
				appShellRef.current.style.setProperty(
					"--app-shell-aside-width",
					`${width}px`,
				);
				appShellRef.current.style.setProperty(
					"--app-shell-aside-offset",
					`${width}px`,
				);
			}

			if (last) {
				const staysOpen = width > 300;
				if (staysOpen) setAsideWidth(width);
				setAsideOpen(staysOpen);
				setIsResizingAside(false);
			}
		},
		{ axis: "x", filterTaps: true },
	);
	const dragSidebarClose = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) =>
			isMobile &&
			movementX < -50 &&
			directionX < 0 &&
			AppService.closeSidebar() &&
			cancel(),
		{ axis: "x", filterTaps: true },
	);
	const dragAsideClose = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) =>
			movementX > 50 && directionX > 0 && AppService.closeAside() && cancel(),
		{ axis: "x", filterTaps: true },
	);

	useEffect(() => {
		document.body.classList.toggle(
			"unselectable",
			isResizingSidebar || isResizingAside,
		);
	}, [isResizingAside, isResizingSidebar]);
	useLayoutEffect(() => {
		if (isResizingSidebar) return;
		appShellRef.current?.style.removeProperty("--app-shell-navbar-width");
		appShellRef.current?.style.removeProperty("--app-shell-navbar-offset");
		appShellRef.current?.style.removeProperty("--sidebar-expanded-opacity");
		appShellRef.current?.style.removeProperty("--sidebar-collapsed-opacity");
		appShellRef.current?.style.removeProperty("--sidebar-expanded-visibility");
		appShellRef.current?.style.removeProperty("--sidebar-collapsed-visibility");
		appShellRef.current?.style.removeProperty("--sidebar-opacity-transition");
		if (sidebarContentRef.current)
			sidebarContentRef.current.style.opacity = "1";
		if (sidebarResizeHandleRef.current) {
			sidebarResizeHandleRef.current.style.left = isSidebarOpen
				? "293px"
				: isMobile
					? "0px"
					: "53px";
		}
	}, [isMobile, isResizingSidebar, isSidebarOpen]);
	useLayoutEffect(() => {
		if (isResizingAside) return;
		appShellRef.current?.style.removeProperty("--app-shell-aside-width");
		appShellRef.current?.style.removeProperty("--app-shell-aside-offset");
		if (asideContentRef.current) asideContentRef.current.style.opacity = "1";
		if (asideResizeHandleRef.current) {
			asideResizeHandleRef.current.style.right = isAsideOpen
				? isMobile
					? "calc(100% - 7px)"
					: `${asideWidth - 7}px`
				: "0px";
		}
	}, [asideWidth, isAsideOpen, isMobile, isResizingAside]);

	return (
		<MantineProvider
			theme={mantineTheme}
			forceColorScheme={theme}
			cssVariablesResolver={cssResolver}
		>
			<ModalsProvider>
				<Tauri />
				<Box pos="relative" h={viewportHeight} ref={containerRef}>
					<LoadingOverlay
						visible={session.isPending}
						zIndex={1000}
						overlayProps={{ blur: 2 }}
					/>
					<AppShell
						ref={appShellRef}
						withBorder={false}
						navbar={{
							width: isMobile ? 300 : isSidebarOpen ? 300 : 60,
							breakpoint: AppService.breakpoint,
							collapsed: { desktop: false, mobile: !isSidebarOpen },
						}}
						aside={{
							width: isMobile ? "100%" : asideWidth,
							breakpoint: AppService.breakpoint,
							collapsed: { desktop: !isAsideOpen, mobile: !isAsideOpen },
						}}
						style={{
							height: `${viewportHeight}px`,
							maxHeight: `${viewportHeight}px`,
							overflow: "hidden",
							//*REVERT?* transform: `translateY(${viewport.offsetTop}px)`,
						}}
						styles={{
							navbar: {
								zIndex: "calc(var(--mantine-z-index-app) + 2)",
								transition: isResizingSidebar
									? "width 0ms, min-width 0ms, transform 300ms ease"
									: "width 250ms ease, min-width 250ms ease, transform 300ms ease",
							},
							aside: {
								zIndex: "calc(var(--mantine-z-index-app) + 2)",
								transition: isResizingAside
									? "width 0ms, min-width 0ms, transform 300ms ease"
									: "width 250ms ease, min-width 250ms ease, transform 300ms ease",
							},
							main: {
								transition:
									isResizingSidebar || isResizingAside
										? "padding-inline-start 0ms, padding-inline-end 0ms"
										: "padding-inline-start 250ms ease, padding-inline-end 250ms ease",
							},
						}}
					>
						{(!isAsideOpen || !isMobile) && (
							<div
								ref={sidebarResizeHandleRef}
								{...dragSidebarResize()}
								style={{
									position: "absolute",
									top: 0,
									left: isSidebarOpen ? 293 : isMobile ? 0 : 53,
									bottom: 0,
									width: 15,
									zIndex: "var(--mantine-z-index-max)",
									touchAction: "none",
									cursor: "ew-resize",
								}}
							/>
						)}
						{(!isSidebarOpen || !isMobile) && (
							<div
								ref={asideResizeHandleRef}
								{...dragAsideResize()}
								style={{
									position: "absolute",
									top: 0,
									right: isAsideOpen
										? isMobile
											? "calc(100% - 7px)"
											: asideWidth - 7
										: 0,
									bottom: 0,
									width: 15,
									zIndex: "var(--mantine-z-index-max)",
									touchAction: "none",
									cursor: "ew-resize",
								}}
							/>
						)}
						<AppShell.Navbar
							{...dragSidebarClose()}
							p={10}
							style={{
								touchAction: "pan-y",
								fontWeight: 450,
							}}
							withBorder
						>
							<div ref={sidebarContentRef} style={{ height: "100%" }}>
								<Sidebar />
							</div>
						</AppShell.Navbar>
						<AppShell.Main
							style={{
								height: `${viewportHeight}px`,
								maxHeight: `${viewportHeight}px`,
								minHeight: 0,
								overflow: "hidden",
							}}
						>
							<Chat />
						</AppShell.Main>
						<AppShell.Aside
							{...dragAsideClose()}
							p={10}
							style={{
								touchAction: "pan-y",
								fontWeight: 450,
							}}
							withBorder
						>
							<div ref={asideContentRef} style={{ height: "100%" }}>
								<ChatFiles />
							</div>
						</AppShell.Aside>
					</AppShell>
				</Box>
				<Console />
				<Background />
			</ModalsProvider>
		</MantineProvider>
	);
}
