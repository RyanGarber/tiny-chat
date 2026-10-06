import { Channel } from "@tauri-apps/api/core";
import { createAFMProvider } from "#core/features/provider/providers/model/AFMProvider.ts";
import type { AFMEvent } from "#core/features/provider/types/afm.ts";
import { TauriUtils } from "#gui/features/tauri/utils/TauriUtils.ts";

/** afmize through the Tauri commands in `apps/app/src/afm.rs`. */
export const AFMProvider = createAFMProvider({
	availability: () => TauriUtils.invoke<string>("afm_availability"),
	stream: (request, onEvent) => {
		const channel = new Channel<AFMEvent>();
		channel.onmessage = onEvent;
		return TauriUtils.invoke<number>("afm_stream", {
			request,
			onEventChannel: channel,
		});
	},
	cancel: async (id) => {
		await TauriUtils.invoke("afm_cancel", { streamId: id });
	},
});
