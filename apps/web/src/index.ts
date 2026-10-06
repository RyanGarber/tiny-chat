import { server } from "#web/server.ts";

if (import.meta.main) {
	server.start();
}
