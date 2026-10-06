import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "ink";
import { client } from "#cli/client.ts";
import { TokenService } from "#cli/core/services/TokenService.ts";
import { ClientContext } from "#client/client.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import Root from "#tui/core/components/Root.tsx";
import { StdinUtils } from "#tui/core/utils/StdinUtils.ts";

export async function main(keyring: boolean | undefined) {
	if (keyring === false) TokenService.enableTempFile();
	const stdin = StdinUtils.filter(process.stdin);

	const instance = render(
		<QueryClientProvider client={client.queryClient}>
			<ClientContext value={client}>
				<Root />
			</ClientContext>
		</QueryClientProvider>,
		{
			exitOnCtrlC: false,
			patchConsole: CommonUtils.isTruthy(process.env.DEV),
			stdin,
			// Legacy terminal input cannot say which modifiers a key was pressed
			// with: an arrow under Shift, under Alt, or under both can all arrive
			// as the same bytes, which is what leaves Alt and Shift selection to
			// the terminal's own key mapping. The kitty protocol reports them
			// apart, and the query behind `auto` is ignored by terminals that do
			// not speak it, so the ones that do need no setting turned on.
			kittyKeyboard: { mode: "auto" },
		},
	);

	// The UI quits by unmounting, which has run its cleanup by now. What
	// remains (queries, MCP servers, workers) is the process's to end.
	try {
		await instance.waitUntilExit();
	} finally {
		// Detach the adapter without closing the terminal owned by the process.
		stdin.destroy();
	}
	process.exit(0);
}
