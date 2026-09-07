import { server } from "./server.ts";

if (import.meta.main) {
	server.start();
}
