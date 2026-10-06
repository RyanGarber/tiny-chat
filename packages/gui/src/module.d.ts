declare global {
	interface Window {
		__TAURI__?: unknown;
	}
}
declare const __TAURI_DEV_HOST__: string | undefined;
