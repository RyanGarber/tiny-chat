import type { zUser } from '../../types/user.ts';
import type { BaseProvider } from '../index.ts';
import { LegiscanProvider } from './legiscan.ts';

export interface OtherProvider extends BaseProvider {
  check: (user: zUser) => Promise<boolean>;
}

export const otherProviders: OtherProvider[] = [LegiscanProvider];
