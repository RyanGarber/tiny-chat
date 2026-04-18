import type { Family } from './index.ts';
import type { ModelArg } from '../types.ts';

export const AmazonFamily: Family = {
  getArgs(model) {
    const args: ModelArg[] = [];
    if (model.includes('nova-')) {
      args.push({
        name: 'thinking',
        type: 'list' as const,
        values: ['none', 'low', 'medium', 'high'],
        default: 'medium',
      });
    }
    return args;
  },
};
