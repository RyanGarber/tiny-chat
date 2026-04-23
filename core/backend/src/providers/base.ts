import type { User } from '../server.ts';

/** Shared structure every provider must expose. */
export interface BaseProvider {
  name: string;
  /** Setting keys whose values users supply (e.g. 'apiKey'). */
  settings: string[];
}

/** Shared shape returned by the providers.list route for every category. */
export interface BaseProviderStatus {
  name: string;
  settings: string[];
  error?: string;
}

/** Run `check()` and fold errors into the status object. */
export async function checkProvider(
  provider: BaseProvider & { check: (user: User) => Promise<boolean> },
  user: User,
): Promise<BaseProviderStatus & { available: boolean }> {
  try {
    return {
      name: provider.name,
      settings: provider.settings,
      available: await provider.check(user),
    };
  } catch (e) {
    console.error(`Failed to test provider ${provider.name}:`, e);
    return {
      name: provider.name,
      settings: provider.settings,
      available: false,
      error: (e as Error).message ?? (e as Error).name ?? 'Unknown',
    };
  }
}
