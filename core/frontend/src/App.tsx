import { useEffect } from 'react';
import { AppShell, Box, LoadingOverlay, MantineProvider, Overlay, Text } from '@mantine/core';
import { NavigationProgress } from '@mantine/nprogress';
import { useDrag } from '@use-gesture/react';
import Chat from '@/components/Chat.tsx';
import Sidebar from '@/components/Sidebar.tsx';
import { useLayout } from '@/stores/layout.tsx';
import { useChats } from '@/stores/chats.tsx';
import { useProviders } from '@/stores/providers.tsx';
import { auth, trpc } from '@/utils/api';
import { hljsAdapter } from '@/utils/highlight';
import { useViewport } from '@/utils/ui';
import { Notifications } from '@mantine/notifications';
import { useSettings } from '@/stores/settings.tsx';
import { CodeHighlightAdapterProvider } from '@mantine/code-highlight';
import { cssResolver, theme } from '@/theme.tsx';
import { modals, ModalsProvider } from '@mantine/modals';
import Tasks from '@/components/Tasks.tsx';
import { useTasks } from '@/stores/tasks.tsx';
import { usePersistence } from '@/stores/persistence.tsx';

export default function App() {
  const {
    mobile,
    isMobile,
    shadow,
    totalGestureBlocks,
    drawerCloser,
    isSidebarOpen,
    setSidebarOpen,
    getSidebarWidth,
    isInitializing,
    setInitializing,
  } = useLayout();

  const session = auth.useSession();

  useEffect(() => {
    if (isInitializing) {
      if (session.isPending) return;

      if (!session.data || session.error) {
        void (async () => {
          const result = await auth.signIn.anonymous();
          if (result.data?.token) localStorage.setItem('token', result.data.token);
        })();
        return;
      }

      const oldToken = localStorage.getItem('token');
      localStorage.setItem('token', session.data.session.token);
      if (session.data.session.token !== oldToken) {
        window.location.reload();
        return;
      }

      if (window.location.hash.startsWith('#/app/') && !session.data.user.isAnonymous) {
        void (async () => {
          const id = window.location.hash.slice('#/app/'.length);
          console.log('Accepting clone', id);
          await trpc.sessions.acceptClone.mutate({ id });
          window.location.hash = '#/';
        })();
      }

      const uninit: (() => void)[] = [];
      void (async () => {
        try {
          await useSettings.getState().init(); // init first so tasks have access
          uninit.push(useTasks.getState().init()); // init first so updates always work
          await useProviders.getState().init();
          await useChats.getState().init();
          await usePersistence.getState().init();
        } catch (e: unknown) {
          modals.open({
            children: (
              <Text ta="center">
                Tiny Chat isn't available right now.
                <br />
                Please try again later.
              </Text>
            ),
            withCloseButton: false,
            closeOnClickOutside: false,
            closeOnEscape: false,
            centered: true,
          });
          throw e;
        }

        setInitializing(false);
      })();
      return () => uninit.forEach((d) => d());
    }
  }, [isInitializing, setInitializing, session.data, session.isPending, session.error]);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile, setSidebarOpen]);

  // TODO - maybe drag area should be bigger (but it blocks)
  const navbarDragOpen = useDrag(
    ({ movement: [movementX], direction: [directionX], cancel }) => {
      if (movementX > 50 && directionX > 0 && !totalGestureBlocks) {
        setSidebarOpen(true);
        cancel();
      }
    },
    { axis: 'x', filterTaps: true },
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
    { axis: 'x', filterTaps: true },
  );

  const { height: viewportHeight, containerRef } = useViewport();
  const colorScheme = useSettings((s) => s.getTheme()) as 'light' | 'dark' | undefined;
  return (
    <MantineProvider
      theme={theme}
      forceColorScheme={colorScheme}
      cssVariablesResolver={cssResolver}
    >
      <ModalsProvider>
        <CodeHighlightAdapterProvider adapter={hljsAdapter}>
          <Tasks />
          <NavigationProgress />
          <Notifications position="bottom-right" />
          <Box pos="relative" h={viewportHeight} ref={containerRef}>
            <LoadingOverlay visible={isInitializing} zIndex={1000} overlayProps={{ blur: 2 }} />
            <AppShell
              withBorder={false}
              navbar={{
                width: isMobile ? 300 : getSidebarWidth(),
                breakpoint: mobile,
                collapsed: { desktop: false, mobile: !isSidebarOpen },
              }}
              style={{
                height: `${viewportHeight}px`,
                maxHeight: `${viewportHeight}px`,
                overflow: 'hidden',
                //*REVERT?* transform: `translateY(${viewport.offsetTop}px)`,
              }}
              styles={{
                navbar: {
                  zIndex: 'calc(var(--mantine-z-index-app) + 2)',
                  transition: 'width 250ms ease, min-width 250ms ease, transform 300ms ease',
                  backgroundColor: 'var(--tc-sidebar-bg)',
                },
                main: {
                  transition: 'padding-inline-start 250ms ease',
                },
              }}
            >
              <div
                {...navbarDragOpen()}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 15,
                  zIndex: 'var(--mantine-z-index-max)',
                  touchAction: 'none',
                }}
              ></div>
              {isSidebarOpen && isMobile && (
                <Overlay
                  opacity={1}
                  color="#000"
                  zIndex="calc(var(--mantine-z-index-app) + 1)"
                  onClick={() => setSidebarOpen(false)}
                  {...navbarDragClose()}
                  style={{ touchAction: 'none' }}
                />
              )}
              <AppShell.Navbar
                {...navbarDragClose()}
                p={10}
                style={{
                  boxShadow: isSidebarOpen || !isMobile ? shadow : '',
                  touchAction: 'pan-y',
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
                  overflow: 'hidden',
                }}
              >
                <Chat />
              </AppShell.Main>
            </AppShell>
          </Box>
        </CodeHighlightAdapterProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
