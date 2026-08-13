import {
	type CapabilitiesType,
	type UploadsType,
	useAppStore,
} from "#app/core/stores/useAppStore.ts";

export const AppService = {
	breakpoint: "48em",

	get isMobile() {
		return window.matchMedia(`(max-width: ${AppService.breakpoint})`).matches;
	},

	initialize: () => {
		const listener = () => {
			const { setMobile } = useAppStore.getState();
			setMobile(AppService.isMobile);
		};
		listener();
		window.addEventListener("resize", listener);
		return () => window.removeEventListener("resize", listener);
	},

	openSidebar: () => {
		const { currentModal, setSidebarOpen } = useAppStore.getState();

		if (!currentModal) {
			setSidebarOpen(true);
			return true;
		}

		return false;
	},

	closeSidebar: () => {
		const {
			currentModal,
			currentDrawer,
			setCurrentDrawer,
			isSidebarOpen,
			setSidebarOpen,
		} = useAppStore.getState();

		if (!currentModal) {
			if (currentDrawer) {
				setCurrentDrawer(null);
				return true;
			}

			if (isSidebarOpen) {
				setSidebarOpen(false);
				return true;
			}
		}

		return false;
	},

	openAside: () => {
		const { currentModal, setAsideOpen } = useAppStore.getState();

		if (!currentModal) {
			setAsideOpen(true);
			return true;
		}

		return false;
	},

	closeAside: () => {
		const { currentModal, setAsideOpen } = useAppStore.getState();

		if (!currentModal) {
			setAsideOpen(false);
			return true;
		}

		return false;
	},

	openUploads: (uploads?: UploadsType) => {
		const { setCurrentModal, setCurrentUploads } = useAppStore.getState();

		setCurrentModal("uploads");
		if (uploads) setCurrentUploads(uploads);
		return true;
	},

	openCapabilities: (capabilities?: CapabilitiesType) => {
		const { setCurrentModal, setCurrentCapabilities } = useAppStore.getState();

		setCurrentModal("capabilities");
		if (capabilities) setCurrentCapabilities(capabilities);
		return true;
	},
} as const;
