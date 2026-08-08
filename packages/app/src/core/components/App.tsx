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
import Background from "#app/core/components/Background.tsx";
import Console from "#app/core/components/Console.tsx";
import Tauri from "#app/core/components/Tauri.tsx";
import { useExperiments } from "#app/core/hooks/useExperiments.tsx";
import { useViewport } from "#app/core/hooks/useViewport.ts";
import { AppService } from "#app/core/services/AppService.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Chat from "#app/features/chat/components/Chat.tsx";
import ChatFiles from "#app/features/chat/components/ChatFiles.tsx";
import Sidebar from "#app/features/sidebar/components/Sidebar.tsx";
import { cssResolver, theme as mantineTheme } from "#app/theme.tsx";
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
	const getSidebarWidth = useAppStore((s) => s.getSidebarWidth);

	useEffect(() => AppService.initialize(), []);

	// TODO - find a way to increase this drag area without blocking mouse events
	const dragSidebarOpen = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) =>
			movementX > 50 && directionX > 0 && AppService.openSidebar() && cancel(),
		{ axis: "x", filterTaps: true },
	);
	const dragAsideOpen = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) =>
			movementX < -50 && directionX < 0 && AppService.openAside() && cancel(),
		{ axis: "x", filterTaps: true },
	);
	const dragSidebarClose = useDrag(
		({ movement: [movementX], direction: [directionX], cancel }) =>
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
						withBorder={false}
						navbar={{
							width: isMobile ? 300 : getSidebarWidth(),
							breakpoint: AppService.breakpoint,
							collapsed: { desktop: false, mobile: !isSidebarOpen },
						}}
						aside={{
							width: 300,
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
								transition:
									"width 250ms ease, min-width 250ms ease, transform 300ms ease",
								...StyleUtils.glass,
								borderLeft: "none",
								borderBottom: "none",
								borderTop: "none",
							},
							aside: {
								zIndex: "calc(var(--mantine-z-index-app) + 2)",
								...StyleUtils.glass,
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
							{...dragSidebarOpen()}
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
							{...dragAsideOpen()}
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
								{...dragSidebarClose()}
								style={{ touchAction: "none" }}
							/>
						)}
						<AppShell.Navbar
							{...dragSidebarClose()}
							p={10}
							style={{
								...StyleUtils.glass,
								boxShadow: isSidebarOpen || !isMobile ? StyleUtils.shadow : "",
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
							{...dragAsideClose()}
							p={10}
							style={{
								boxShadow: isSidebarOpen || !isMobile ? StyleUtils.shadow : "",
								touchAction: "pan-y",
								fontWeight: 450,
							}}
						>
							<ChatFiles />
						</AppShell.Aside>
					</AppShell>
				</Box>
				<Console />
				<Background />
			</ModalsProvider>
		</MantineProvider>
	);
}
