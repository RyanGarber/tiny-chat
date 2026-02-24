import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";

interface Layout {
    mobile: string;
    isMobile: boolean;
    setMobile: (value: boolean) => void;

    totalGestureBlocks: number;
    setGestureBlock: (value: boolean) => void;

    isSidebarOpen: boolean;
    setSidebarOpen: (value: boolean) => void;
    getSidebarWidth: () => number;

    isInitializing: boolean;
    setInitializing: (value: boolean) => void;

    isMessaging: boolean;
    setIsMessaging: (value: boolean) => void;

    isMessagingDisabled: boolean;
    setMessagingDisabled: (value: boolean) => void;

    shadow: string;
}

export const useLayout = create(
    subscribeWithSelector<Layout>((set, get) => {
        const mobile = "48em"; // useMantineTheme().breakpoints.sm
        const isMobile = window.matchMedia(`(max-width: ${mobile})`);

        window.addEventListener("resize", () => {
            set({isMobile: isMobile.matches});
        });

        return {
            mobile,
            isMobile: isMobile.matches,
            setMobile: (value: boolean) => set({isMobile: value}),

            totalGestureBlocks: 0,
            setGestureBlock: (value: boolean) =>
                set((state) => ({
                    totalGestureBlocks: value
                        ? state.totalGestureBlocks + 1
                        : Math.max(0, state.totalGestureBlocks - 1),
                })),

            isSidebarOpen: false,
            setSidebarOpen: (value: boolean) => set({isSidebarOpen: value}),
            getSidebarWidth: () => (get().isSidebarOpen ? 300 : 60),

            isInitializing: true,
            setInitializing: (value: boolean) => set({isInitializing: value}),

            isMessaging: false,
            setIsMessaging: (value: boolean) => set({isMessaging: value}),

            isMessagingDisabled: false,
            setMessagingDisabled: (value: boolean) => set({isMessagingDisabled: value}),

            shadow: "rgba(0, 0, 0, 0.2) 2px 0px 15px",
        };
    }),
);
