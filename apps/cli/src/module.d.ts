declare module "marked-terminal" {
	interface MarkedTerminalOptions {
		width?: number;
		reflowText?: boolean;
		unescape: boolean;
		emoji: boolean;
		showSectionPrefix: boolean;
		tab: number;
		tableOptions: Record<string, unknown>;
	}

	export function markedTerminal(options?: Partial<MarkedTerminalOptions>): any;
}
