import { Capacitor } from "@capacitor/core";
import type { ClientRuntime } from "#gui/core/types/runtime.ts";
import { RuntimeUtils } from "#gui/core/utils/RuntimeUtils.ts";
import { ClipboardService } from "#mobile/core/services/ClipboardService.ts";
import { KeyboardService } from "#mobile/core/services/KeyboardService.ts";

/**
 * The mobile app's runtime: the GUI in a Capacitor webview, or the web's in a
 * browser (Vite's dev server, opened outside the app).
 */
export const runtime: ClientRuntime = Capacitor.isNativePlatform()
	? {
			platform: Capacitor.getPlatform() as "ios" | "android",
			// Capacitor hands a new window to the system browser.
			open: RuntimeUtils.web.open,
			copy: Capacitor.isPluginAvailable("Clipboard")
				? ClipboardService.copy
				: undefined,
			onKeyboard: Capacitor.isPluginAvailable("keyboard")
				? KeyboardService.onKeyboard
				: undefined,
			getModelProviders: async () => {
				if (!Capacitor.isPluginAvailable("afmize")) return [];
				const { AFMProvider } = await import(
					"#mobile/core/services/AfmService.ts"
				);
				return [AFMProvider];
			},
		}
	: RuntimeUtils.web;
