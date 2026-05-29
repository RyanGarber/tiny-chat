import { useEffect } from 'react';
import { AppShell, Box, LoadingOverlay, MantineProvider, Overlay } from '@mantine/core';
import { NavigationProgress } from '@mantine/nprogress';
import { useDrag } from '@use-gesture/react';
import Chat from '@/features/chat/components/Chat';
import Sidebar from '@/core/components/Sidebar';
import { useLayout } from '@/stores/layout.tsx';
import { auth, trpc } from '@/utils/api';
import { useViewport } from '@/utils/ui';
import { Notifications } from '@mantine/notifications';
import { cssResolver, theme as mantineTheme } from '@/theme.tsx';
import { glassStyle } from '@/utils/glass';
import { ModalsProvider } from '@mantine/modals';
import Tasks from '@/core/components/Tasks';
import { setHashbang, useHashbang } from '../hooks/useHashbang';
import Aurora from '@/core/components/Aurora';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { useThemes } from '@/features/settings/hooks/useThemes';

export default function App() {
  const mobile = useLayout((s) => s.mobile);
  const isMobile = useLayout((s) => s.isMobile);
  const shadow = useLayout((s) => s.shadow);
  const totalGestureBlocks = useLayout((s) => s.totalGestureBlocks);
  const drawerCloser = useLayout((s) => s.drawerCloser);
  const isSidebarOpen = useLayout((s) => s.isSidebarOpen);
  const setSidebarOpen = useLayout((s) => s.setSidebarOpen);
  const getSidebarWidth = useLayout((s) => s.getSidebarWidth);
  const isInitializing = useLayout((s) => s.isInitializing);
  const setInitializing = useLayout((s) => s.setInitializing);

  const session = auth.useSession();

  const { hash, query } = useHashbang();

  useEffect(() => {
    if (query.token) {
      localStorage.setItem('token', decodeURIComponent(query.token));
      setHashbang(hash, { ...query, token: undefined });
    }

    if (isInitializing) {
      if (session.isPending) return;

      if (!session.data || session.error) {
        void (async () => {
          const result = await auth.signIn.anonymous();
          if (result.data?.token) localStorage.setItem('token', result.data.token);
        })();
        return;
      }

      setInitializing(false);
      console.log('>> session:', session.data);

      if (!session.data.session?.token) {
        return;
      }

      console.log('>> session token:', session.data.session?.token);
      const oldToken = localStorage.getItem('token');
      localStorage.setItem('token', session.data.session.token);
      if (session.data.session.token !== oldToken) {
        console.log('>> session token changed:', `${oldToken} -> ${session.data.session.token}`);
        window.location.reload();
        return;
      }

      if (query.clone) {
        console.log('Accepting clone', query.clone);
        void trpc.sessions.acceptClone.mutate({ id: query.clone });
        setHashbang(hash, { ...query, clone: undefined });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, setInitializing, session.data, session.isPending, session.error]);

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

  const createIncognito = useChatStore((s) => s.createIncognito);

  const { height: viewportHeight, containerRef } = useViewport();
  const { theme } = useThemes();

  return (
    <MantineProvider
      theme={mantineTheme}
      forceColorScheme={theme.data}
      cssVariablesResolver={cssResolver}
    >
      <ModalsProvider>
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
                ...glassStyle,
                borderLeft: 'none',
                borderBottom: 'none',
                borderTop: 'none',
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
        <Box pos="absolute" inset={0} style={{ zIndex: -1, opacity: 0.25 }}>
          <Aurora
            colorStops={
              createIncognito
                ? ['#888888', '#aaaaaa', '#888888']
                : ['#1b72de', '#587ec1', '#1a5bc4']
            }
            blend={2}
            amplitude={1}
            speed={0.25}
          />
        </Box>
      </ModalsProvider>
    </MantineProvider>
  );
}
