export const CommonUtils = {
	webUrl: import.meta.env.DEV
		? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_WEB_PORT}`
		: import.meta.env.VITE_WEB_URL,

	backendUrl: import.meta.env.DEV
		? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}`
		: import.meta.env.VITE_BACKEND_URL,

	get env() {
		return {
			...import.meta.env,
			VITE_BACKEND_URL: CommonUtils.backendUrl,
		};
	},
} as const;
