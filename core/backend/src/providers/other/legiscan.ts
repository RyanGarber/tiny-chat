import type { OtherProvider } from './index.ts';
import { LegiscanClient, State } from '@ryangarber/legiscan-ts';

export const LegiscanProvider: OtherProvider = {
  name: 'legiscan',
  settings: ['apiKey'],

  async check(user) {
    if (!user.settings.providers?.legiscan?.apiKey) return false;

    const client = new LegiscanClient(user.settings.providers.legiscan.apiKey);
    await client.getSessionList({ state: State.DC });

    return true;
  },
};
