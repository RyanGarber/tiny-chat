import {
	AppShell,
	Box,
	LoadingOverlay,
	MantineProvider,
	Overlay,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { useDrag } from "@use-gesture/react";
import { useEffect, useMemo } from "react";
import Background from "#frontend/core/components/Background.tsx";
import Sidebar from "#frontend/core/components/Sidebar.tsx";
import Tauri from "#frontend/core/components/Tauri.tsx";
import { useExperiments } from "#frontend/core/hooks/useExperiments.tsx";
import { useLayoutStore } from "#frontend/core/stores/useLayoutStore.tsx";
import Chat from "#frontend/features/chat/components/Chat.tsx";
import ChatFiles from "#frontend/features/chat/components/ChatFiles.tsx";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { cssResolver, theme as mantineTheme } from "#frontend/theme.tsx";
import { auth, trpc } from "#frontend/utils/api.ts";
import { GLASS_STYLE, SHADOW } from "#frontend/utils/theme.ts";
import { useViewport } from "#frontend/utils/ui.tsx";
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

	const session = auth.useSession();

	const { hash, query } = useHashbang();
	useExperiments();

	// biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle
	useEffect(() => {
		if (query.token) {
			localStorage.setItem("token", decodeURIComponent(query.token));
			setHashbang(hash, { ...query, token: undefined });
		}

		if (isInitializing) {
			if (session.isPending) return;

			if (!session.data || session.error) {
				void (async () => {
					const result = await auth.signIn.anonymous();
					if (result.data?.token)
						localStorage.setItem("token", result.data.token);
				})();
				return;
			}

			setInitializing(false);
			console.log(">> session:", session.data);

			if (!session.data.session?.token) {
				return;
			}

			console.log(">> session token:", session.data.session?.token);
			const oldToken = localStorage.getItem("token");
			localStorage.setItem("token", session.data.session.token);
			if (session.data.session.token !== oldToken) {
				console.log(
					">> session token changed:",
					`${oldToken} -> ${session.data.session.token}`,
				);
				window.location.reload();
				return;
			}

			if (query.clone) {
				console.log("Accepting clone", query.clone);
				void trpc.user.acceptClone.mutate({ id: query.clone });
				setHashbang(hash, { ...query, clone: undefined });
			}
		}
	}, [
		isInitializing,
		setInitializing,
		session.data,
		session.isPending,
		session.error,
	]);

	// TODO - maybe drag area should be bigger (but it blocks)
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

	const createIncognito = useChatStore((s) => s.createIncognito);
	const { chat } = useChat();
	const incognito = useMemo(
		() => chat.data?.incognito ?? createIncognito,
		[chat.data?.incognito, createIncognito],
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
				<Box
					pos="absolute"
					inset={0}
					style={{
						zIndex: -1,
						maskImage: `linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)`,
						opacity: chat.data ? 0.125 : 0.5,
						transition: "opacity 0.3s ease",
					}}
				>
					<Background incognito={incognito} />
				</Box>
			</ModalsProvider>
		</MantineProvider>
	);
}
