import clipboard from "clipboardy";
import { CommonUtils } from "../utils/CommonUtils.ts";
import { AuthService } from "./AuthService.ts";
import { KeyringService } from "./KeyringService.ts";
import { tRPCService } from "./tRPCService.ts";

export const SessionService = {
	/**
	 * Get the current session or create a new one.
	 */
	getSession: async (): Promise<typeof AuthService.$Infer.Session> => {
		const token = KeyringService.getSessionToken();

		let session: typeof AuthService.$Infer.Session | undefined;

		if (token) {
			const getSession = await AuthService.getSession();
			if (getSession.data) {
				session = getSession.data;
			}
		}

		if (!session) {
			const signIn = await AuthService.signIn.anonymous();
			if (signIn.error || !signIn.data) throw signIn.error;

			KeyringService.setSessionToken(signIn.data.token);

			const getSession = await AuthService.getSession();
			if (getSession.error || !getSession.data) throw getSession.error;
			session = getSession.data;
		}

		return session;
	},

	cloneSession: async () => {
		const id = await tRPCService.user.createClone.mutate();

		const url = `${CommonUtils.webUrl}/#?clone=${id}`;
		await clipboard.write(url);

		console.log(`URL has been copied to your clipboard: ${url}`);
		console.log("Waiting for you to sign in...");

		const wait = async () => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			const result = await tRPCService.user.completeClone.mutate({ id });
			if (!result) await wait();
		};

		await wait();
	},
} as const;
