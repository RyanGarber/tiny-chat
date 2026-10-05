import { Entry } from "@napi-rs/keyring";

const NAME = "tiny-chat";
let session: Entry | null = null;

export const KeyringService = {
	name: NAME,

	getSession: () => (session ??= new Entry(NAME, "session")),
	getSessionToken: () => {
		return KeyringService.getSession().getPassword();
	},
	setSessionToken: (token: string) => {
		return KeyringService.getSession().setPassword(token);
	},
} as const;
