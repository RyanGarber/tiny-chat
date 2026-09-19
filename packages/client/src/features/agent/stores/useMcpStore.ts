import type { Client } from "@modelcontextprotocol/client";
import { create } from "zustand";

interface McpStore {
	connectedServers: Record<string, Client>;
	setConnectedServer: (name: string, client: Client | null) => void;
}

export const useMcpStore = create<McpStore>((set) => ({
	connectedServers: {},
	setConnectedServer: (name, client) =>
		set((state) => {
			const connectedServers = { ...state.connectedServers };
			if (client) connectedServers[name] = client;
			else delete connectedServers[name];
			return { connectedServers };
		}),
}));
