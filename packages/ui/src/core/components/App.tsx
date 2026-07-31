import {
	AppShell,
	Box,
	LoadingOverlay,
	MantineProvider,
	Overlay,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { useDrag } from "@use-gesture/react";
import { useEffect } from "react";
import { useSession } from "#react/src/core/hooks/useSession.ts";
import Background from "#ui/core/components/Background.tsx";
import Sidebar from "#ui/core/components/Sidebar.tsx";
import Tauri from "#ui/core/components/Tauri.tsx";
import { useExperiments } from "#ui/core/hooks/useExperiments.tsx";
import { useViewport } from "#ui/core/hooks/useViewport.ts";
import { useLayoutStore } from "#ui/core/stores/useLayoutStore.tsx";
import Chat from "#ui/features/chat/components/Chat.tsx";
import ChatFiles from "#ui/features/chat/components/ChatFiles.tsx";
import { useThemes } from "#ui/features/settings/hooks/useThemes.ts";
import { cssResolver, theme as mantineTheme } from "#ui/theme.tsx";
import { GLASS_STYLE, SHADOW } from "#ui/utils/style.ts";
import { setHashbang, useHashbang } from "../hooks/useHashbang";

export default function App() {
	const mobile = useLayoutStore((s) => s.mobile);
	const isMobile = useLayoutStore((s) => s.isMobile);
	const totalGestureBlocks = useLayoutStore((s) => s.totalGestureBlocks);
	const drawerCloser = useLayoutStore((s) => s.drawerCloser);
	const isSidebarOpen = useLayoutStore((s) => s.isSidebarOpen);
	const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);
	const isAsideOpen = useLayoutStore((s) => s.isAsideOpen);
	const setAsideOpen = useLayoutStore((s) => s.setAsideOpen);
	const getSidebarWidth = useLayoutStore((s) => s.getSidebarWidth);
	const isInitializing = useLayoutStore((s) => s.isInitializing);
	const setInitializing = useLayoutStore((s) => s.setInitializing);

	const { hash, query } = useHashbang();

	const { session, acceptClone } = useSession({
		setToken: query.token ? decodeURIComponent(query.token) : undefined,
	});

	useEffect(() => {
		if (!session.data) return;

		if (query.token) {
			setHashbang(hash, { ...query, token: undefined });
		}

		if (isInitializing) {
			setInitializing(false);
			if (query.clone && !session.data.user.isAnonymous) {
				acceptClone.mutate(query.clone);
				setHashbang(hash, { ...query, clone: undefined });
			}
		}
	}, [
		isInitializing,
		setInitializing,
		session.data,
		hash,
		query,
		acceptClone.mutate,
	]);

	useExperiments();

	// TODO - find a way to increase this drag area without blocking mouse events
	const navbarDragOpen = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) => {
			if (movementX > 50 && directionX > 0 && !totalGestureBlocks) {
				setSidebarOpen(true);
				cancel();
			}
		},
		{ axis: "x", filterTaps: true },
	);

	const asideDragOpen = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) => {
			if (movementX < -50 && directionX < 0 && !totalGestureBlocks) {
				setAsideOpen(true);
				cancel();
			}
		},
		{ axis: "x", filterTaps: true },
	);

	const navbarDragClose = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) => {
			if (movementX < -50 && directionX < 0) {
				if (totalGestureBlocks) return; // modal open – block completely
				if (drawerCloser) {
					drawerCloser();
					cancel();
					return;
				}
				setSidebarOpen(false);
				cancel();
			}
		},
		{ axis: "x", filterTaps: true },
	);

	const asideDragClose = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) => {
			if (movementX > 50 && directionX > 0) {
				if (totalGestureBlocks) return; // modal open – block completely
				setAsideOpen(false);
				cancel();
			}
		},
		{ axis: "x", filterTaps: true },
	);

	const { height: viewportHeight, containerRef } = useViewport();
	const { theme } = useThemes();

	return (
		<MantineProvider
			theme={mantineTheme}
			forceColorScheme={theme.data}
			cssVariablesResolver={cssResolver}
		>
			<ModalsProvider>
				<Tauri />
				<Box pos="relative" h={viewportHeight} ref={containerRef}>
					<LoadingOverlay
						visible={isInitializing}
						zIndex={1000}
						overlayProps={{ blur: 2 }}
					/>
					<AppShell
						withBorder={false}
						navbar={{
							width: isMobile ? 300 : getSidebarWidth(),
							breakpoint: mobile,
							collapsed: { desktop: false, mobile: !isSidebarOpen },
						}}
						aside={{
							width: 300,
							breakpoint: mobile,
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
								transition:
									"width 250ms ease, min-width 250ms ease, transform 300ms ease",
								...GLASS_STYLE,
								borderLeft: "none",
								borderBottom: "none",
								borderTop: "none",
							},
							aside: {
								zIndex: "calc(var(--mantine-z-index-app) + 2)",
								...GLASS_STYLE,
								borderRight: "none",
								borderBottom: "none",
								borderTop: "none",
							},
							main: {
								transition: "padding-inline-start 250ms ease",
							},
						}}
					>
						<div
							{...navbarDragOpen()}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								bottom: 0,
								width: 15,
								zIndex: "var(--mantine-z-index-max)",
								touchAction: "none",
							}}
						></div>
						<div
							{...asideDragOpen()}
							style={{
								position: "absolute",
								top: 0,
								right: 0,
								bottom: 0,
								width: 15,
								zIndex: "var(--mantine-z-index-max)",
								touchAction: "none",
							}}
						></div>

						{isSidebarOpen && isMobile && (
							<Overlay
								opacity={1}
								color="#000"
								zIndex="calc(var(--mantine-z-index-app) + 1)"
								onClick={() => setSidebarOpen(false)}
								{...navbarDragClose()}
								style={{ touchAction: "none" }}
							/>
						)}
						<AppShell.Navbar
							{...navbarDragClose()}
							p={10}
							style={{
								boxShadow: isSidebarOpen || !isMobile ? SHADOW : "",
								touchAction: "pan-y",
								fontWeight: 450,
							}}
						>
							<Sidebar />
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
							{...asideDragClose()}
							p={10}
							style={{
								boxShadow: isSidebarOpen || !isMobile ? SHADOW : "",
								touchAction: "pan-y",
								fontWeight: 450,
							}}
						>
							<ChatFiles />
						</AppShell.Aside>
					</AppShell>
				</Box>
				<Background />
			</ModalsProvider>
		</MantineProvider>
	);
}
