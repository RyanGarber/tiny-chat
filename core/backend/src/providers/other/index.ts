import type { User } from '../../server.ts';
import type { BaseProvider } from '../base.ts';
//import { LegiScanProvider } from './legiscan.ts';

export interface OtherProvider extends BaseProvider {
  check: (user: User) => Promise<boolean>;
}

export const otherProviders: OtherProvider[] = [];
