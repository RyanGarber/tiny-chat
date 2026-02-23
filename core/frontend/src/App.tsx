import {useEffect} from "react";
import {AppShell, Box, Burger, LoadingOverlay, MantineProvider, Overlay} from "@mantine/core";
import {NavigationProgress} from "@mantine/nprogress";
import {useDrag} from "@use-gesture/react";
import Chat from "@/components/Chat.tsx";
import Sidebar from "@/components/Sidebar.tsx";
import {useLayout} from "@/managers/layout.tsx";
import {useChats} from "@/managers/chats.tsx";
import {useServices} from "@/managers/services.tsx";
import {auth, hljsAdapter, trpc, useViewport} from "@/utils.ts";
import {Notifications} from "@mantine/notifications";
import {useSettings} from "@/managers/settings.tsx";
import {CodeHighlightAdapterProvider} from "@mantine/code-highlight";

export default function App() {
    const {
        mobile,
        isMobile,
        shadow,
        totalGestureBlocks,
        isSidebarOpen,
        setSidebarOpen,
        getSidebarWidth,
        isInitializing,
        setInitializing
    } = useLayout();

    const session = auth.useSession();

    const {init: initSettings} = useSettings();
    const {init: initServices} = useServices();
    const {init: initChats} = useChats();

    useEffect(() => {
        if (isInitializing) {
            if (session.isPending) return;

            if (!session.data || session.error) {
                (async () => {
                    const result = await auth.signIn.anonymous();
                    if (result.data?.token) localStorage.setItem("token", result.data.token);
                })();
                return;
            }

            localStorage.setItem("token", session.data.session.token);

            if (window.location.hash.startsWith("#/app/") && !session.data.user.isAnonymous) {
                (async () => {
                    const id = window.location.hash.slice("#/app/".length);
                    console.log("Accepting clone", id);
                    await trpc.sessions.acceptClone.mutate({id});
                    window.location.hash = "#/";
                })();
            }

            (async () => {
                await initSettings();
                await initServices();
                await initChats();

                setInitializing(false);
            })();
        }
    }, [isInitializing, setInitializing, initChats, initServices, session.data, session.isPending]);

    useEffect(() => {
        setSidebarOpen(!isMobile);
    }, [isMobile]);

    // TODO - maybe drag area should be bigger (but it blocks)
    const navbarDragOpen = useDrag(
        ({movement: [movementX], direction: [directionX], cancel}) => {
            if (movementX > 50 && directionX > 0 && !totalGestureBlocks) {
                setSidebarOpen(true);
                cancel();
            }
        },
        {axis: "x", filterTaps: true},
    );

    const navbarDragClose = useDrag(
        ({movement: [movementX], direction: [directionX], cancel}) => {
            if (movementX < -50 && directionX < 0 && !totalGestureBlocks) {
                setSidebarOpen(false);
                cancel();
            }
        },
        {axis: "x", filterTaps: true},
    );

    const viewport = useViewport();
    return (
        <MantineProvider forceColorScheme={useSettings.getState().getTheme() as any}
                         theme={{fontFamily: "Archivo, sans-serif"}}>
            <CodeHighlightAdapterProvider adapter={hljsAdapter}>
                <NavigationProgress/>
                <Notifications position="top-center"/>
                <Box pos="relative" h={viewport.height} ref={viewport.containerRef}>
                    <LoadingOverlay
                        visible={isInitializing}
                        zIndex={1000}
                        overlayProps={{blur: 2}}
                    />
                    <AppShell
                        navbar={{
                            width: isMobile ? 300 : getSidebarWidth(),
                            breakpoint: mobile,
                            collapsed: {desktop: false, mobile: !isSidebarOpen},
                        }}
                        style={{
                            height: `${viewport.height}px`,
                            maxHeight: `${viewport.height}px`,
                            overflow: "hidden",
                            //*REVERT?* transform: `translateY(${viewport.offsetTop}px)`,
                        }}
                        styles={{
                            navbar: {
                                zIndex: "calc(var(--mantine-z-index-app) + 2)",
                                transition: "width 250ms ease, min-width 250ms ease, transform 300ms ease",
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
                                width: 20,
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
                                style={{touchAction: "none"}}
                            />
                        )}
                        <AppShell.Navbar
                            {...navbarDragClose()}
                            p={10}
                            style={{
                                boxShadow: isSidebarOpen ? shadow : "",
                                touchAction: "pan-y",
                            }}
                        ><Sidebar/></AppShell.Navbar>
                        <AppShell.Main
                            style={{
                                height: `${viewport.height}px`,
                                maxHeight: `${viewport.height}px`,
                                minHeight: 0,
                                overflow: "hidden",
                            }}
                        >
                            <Burger
                                style={{
                                    position: "fixed",
                                    zIndex: "calc(var(--mantine-z-index-app) + 1)",
                                }}
                                m={10}
                                opened={isSidebarOpen}
                                onClick={() => setSidebarOpen(!isSidebarOpen)}
                                display={!isMobile || isSidebarOpen ? "none" : "block"}
                                size="sm"
                            />
                            <Chat/>
                        </AppShell.Main>
                    </AppShell>
                </Box>
            </CodeHighlightAdapterProvider>
        </MantineProvider>
    );
}
