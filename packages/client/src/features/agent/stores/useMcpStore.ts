import type { Client } from "@modelcontextprotocol/client";
import { create } from "zustand";

interface McpStore {
	connectedServers: Client[];
	setConnectedServers: (clients: Client[]) => void;
}

export const useMcpStore = create<McpStore>((set) => ({
	connectedServers: [],
	setConnectedServers: (connections) => set({ connectedServers: connections }),
}));
