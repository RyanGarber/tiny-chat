import type { ClientShell, ClientTransports } from "#client/client.ts";
import type { ModelProvider } from "#core/features/provider/types/model.ts";

export type RuntimePlatform =
	| "web"
	| "macos"
	| "windows"
	| "linux"
	| "ios"
	| "android";

export interface RuntimeUpdate {
	version: string;
	/** When it was released, if the host knows. */
	date?: string;
}

/**
 * What the app can do beyond a browser tab. The web's is
 * `#gui/client-runtime.ts`; each host app (`apps/desktop`, `apps/mobile`)
 * builds the GUI with its own module in that one's place, which is the web's
 * outside the host.
 */
export interface ClientRuntime {
	platform: RuntimePlatform;

	/** Opens a link outside the app. */
	open: (url: string) => Promise<void>;

	/** Asks the user for a folder; null if they cancel. */
	pickFolder?: (_: { defaultPath?: string }) => Promise<string | null>;

	/** Native model providers, such as Apple Foundation Models. */
	getModelProviders?: () => Promise<ModelProvider<any>[]>;

	/** The device's shell and file system; only a desktop has them. */
	shell?: ClientShell;

	/** MCP transports for servers the webview cannot reach itself. */
	transports?: ClientTransports;

	/** Updates to the app itself, where it updates itself. */
	update?: {
		check: () => Promise<RuntimeUpdate | null>;
		/** Downloads and applies it, then relaunches the app. */
		install: (_: { onProgress: (fraction: number) => void }) => Promise<void>;
	};
}
