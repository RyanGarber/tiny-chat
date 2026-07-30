import { cli } from "./main.tsx";

if (import.meta.main) {
	await cli.parseAsync();
}
