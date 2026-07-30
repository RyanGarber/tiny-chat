import { Entry } from "@napi-rs/keyring";

const NAME = "tiny-chat";

export const KeyringService = {
	name: NAME,

	session: new Entry(NAME, "session"),
	getSessionToken: () => {
		return KeyringService.session.getPassword();
	},
	setSessionToken: (token: string) => {
		return KeyringService.session.setPassword(token);
	},
} as const;
