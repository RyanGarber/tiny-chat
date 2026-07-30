import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
	anonymousClient,
	inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import superjson from "superjson";
import type { tRPCRouter } from "#backend/core/routes";
import type { AuthService as BackendAuthService } from "#backend/core/services/AuthService";

export const queryClient = new QueryClient();

export const trpc = createTRPCClient<tRPCRouter>({
	links: [
		httpLink({
			url: import.meta.env.DEV
				? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}${import.meta.env.VITE_BACKEND_PATH_TRPC}`
				: `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_BACKEND_PATH_TRPC}`,
			transformer: superjson,
			headers: () => {
				const token = localStorage.getItem("token");
				return { Authorization: token ? `Bearer ${token}` : undefined };
			},
			methodOverride: "POST",
		}),
	],
});

export const query = createTRPCOptionsProxy({
	client: trpc,
	queryClient: queryClient,
});

// TODO WIP
export const auth = createAuthClient({
	baseURL: import.meta.env.DEV
		? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}`
		: import.meta.env.VITE_BACKEND_URL,
	basePath: import.meta.env.VITE_BACKEND_PATH_AUTH,
	fetchOptions: {
		auth: {
			type: "Bearer",
			token: () => localStorage.getItem("token") ?? undefined,
		},
	},
	plugins: [
		anonymousClient(),
		inferAdditionalFields<typeof BackendAuthService>(),
	],
});

export async function invoke<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> {
	if (!isTauri()) throw new Error(`invoke(${command}) called outside of tauri`);

	const { invoke } = await import("@tauri-apps/api/core");
	return await invoke<T>(command, args).catch((error) => {
		throw new Error(
			`invoke(${command}) failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	});
}

export async function listen<T>(event: string, callback: (data: T) => void) {
	if (!isTauri()) throw new Error(`listen(${event}) called outside of tauri`);

	const { listen } = await import("@tauri-apps/api/event");
	return await listen<T>(event, (event) => callback(event.payload));
}

export function isTauri() {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function isTauriDesktop() {
	if (!isTauri()) return false;
	const { type } = await import("@tauri-apps/plugin-os");
	return ["linux", "macos", "windows"].includes(type());
}

export async function isTauriWithAfm() {
	if (!isTauri()) return false;
	const { type } = await import("@tauri-apps/plugin-os");
	if (!["macos", "ios"].includes(type())) return false;
	return await invoke<boolean>("afm_enabled");
}

export async function openExternal(url: string) {
	if (isTauri()) {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		await openUrl(url);
		return;
	} else {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}
