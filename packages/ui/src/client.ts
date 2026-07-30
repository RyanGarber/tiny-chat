import { createClient } from "@tiny-chat/react/src/client.ts";

export const client = createClient({
	env: import.meta.env,
	host: __TAURI_DEV_HOST__,
	getToken: () => sessionStorage.getItem("token"),
});
