import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface LayoutStore {
	mobile: string;
	isMobile: boolean;
	setMobile: (value: boolean) => void;

	totalGestureBlocks: number;
	setGestureBlock: (value: boolean) => void;

	drawerCloser: (() => void) | null;
	setDrawerCloser: (fn: (() => void) | null) => void;

	isSidebarOpen: boolean;
	setSidebarOpen: (value: boolean) => void;
	getSidebarWidth: () => number;

	isAsideOpen: boolean;
	setAsideOpen: (value: boolean) => void;

	isInitializing: boolean;
	setInitializing: (value: boolean) => void;
}

export const useLayoutStore = create(
	subscribeWithSelector<LayoutStore>((set, get) => {
		const mobile = "48em"; // useMantineTheme().breakpoints.sm
		const isMobile = window.matchMedia(`(max-width: ${mobile})`);

		window.addEventListener("resize", () => {
			set({ isMobile: isMobile.matches });
		});

		return {
			mobile,
			isMobile: isMobile.matches,
			setMobile: (value: boolean) => set({ isMobile: value }),

			totalGestureBlocks: 0,
			setGestureBlock: (value: boolean) =>
				set((state) => ({
					totalGestureBlocks: value
						? state.totalGestureBlocks + 1
						: Math.max(0, state.totalGestureBlocks - 1),
				})),

			drawerCloser: null,
			setDrawerCloser: (fn) => set({ drawerCloser: fn }),

			isSidebarOpen: false,
			setSidebarOpen: (value: boolean) => set({ isSidebarOpen: value }),
			getSidebarWidth: () => (get().isSidebarOpen ? 300 : 60),

			isAsideOpen: false,
			setAsideOpen: (value: boolean) => set({ isAsideOpen: value }),

			isInitializing: true,
			setInitializing: (value: boolean) => set({ isInitializing: value }),
		};
	}),
);
