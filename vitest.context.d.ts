declare global {
	module "vitest" {
		interface ProvidedContext {
			serverUrl: string;
		}
	}
}
