import { create } from "zustand";

export type DrawerType = "settings" | "account";

export type ModalType =
	| "embedding-config"
	| "delete-account"
	| "edit-chat"
	| "edit-folder"
	| "capabilities"
	| "uploads"
	| "console";

export type UploadsType = "attachment" | "github";

export type CapabilitiesType =
	| "tools:native"
	| "tools:mcp"
	| "skills:native"
	| "skills:local";

interface LayoutStore {
	isMobile: boolean;
	setMobile: (value: boolean) => void;

	isSidebarOpen: boolean;
	setSidebarOpen: (value: boolean) => void;

	isAsideOpen: boolean;
	setAsideOpen: (value: boolean) => void;
	asideWidth: number;
	setAsideWidth: (value: number) => void;

	currentDrawer: DrawerType | null;
	setCurrentDrawer: (drawer: DrawerType | null) => void;

	currentModal: ModalType | null;
	setCurrentModal: (modal: ModalType | null) => void;

	currentUploads: UploadsType;
	setCurrentUploads: (upload: UploadsType) => void;

	currentCapabilities: CapabilitiesType;
	setCurrentCapabilities: (capability: CapabilitiesType) => void;
}

export const useAppStore = create<LayoutStore>((set) => ({
	isMobile: false,
	setMobile: (isMobile) => set({ isMobile }),

	isSidebarOpen: false,
	setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

	isAsideOpen: false,
	setAsideOpen: (isAsideOpen) => set({ isAsideOpen }),
	asideWidth: 300,
	setAsideWidth: (asideWidth) => set({ asideWidth }),

	currentDrawer: null,
	setCurrentDrawer: (currentDrawer) => set({ currentDrawer }),

	currentModal: null,
	setCurrentModal: (currentModal) => set({ currentModal }),

	currentUploads: "attachment",
	setCurrentUploads: (currentUploads) => set({ currentUploads }),

	currentCapabilities: "tools:native",
	setCurrentCapabilities: (currentCapabilities) => set({ currentCapabilities }),
}));
