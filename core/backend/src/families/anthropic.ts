import type { Family } from './index.ts';
import { getCommonArgs } from '../utils/consts.ts';
import type { ModelArg } from '../types.ts';

export const AnthropicFamily: Family = {
  getArgs(model) {
    const args: ModelArg[] = [];
    if (model.includes('claude-')) {
      args.push(...getCommonArgs(1));
      if (model.includes('-4-5')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', '2500', '5000', '7500', '10000'],
          default: '2500',
        });
      }
      if (model.includes('-4-6') || model.includes('-4-7')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', 'adaptive'],
          default: 'adaptive',
        });
      }
    }
    return args;
  },
};
