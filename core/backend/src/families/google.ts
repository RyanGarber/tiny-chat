import type { Family } from './index.ts';
import type { ModelArg } from '../types.ts';
import { getCommonArgs } from '../utils/consts.ts';

export const GoogleFamily: Family = {
  getArgs(model) {
    const args: ModelArg[] = [];
    if (model.includes('gemini')) {
      args.push(...getCommonArgs(2));
      if (model.includes('gemini-2.5')) {
        args.push({
          name: 'thinking-budget',
          type: 'list',
          values: ['auto', '0', '2500', '5000', '7500', '10000'],
          default: 'auto',
        });
      }
      if (model.includes('gemini-3')) {
        args.push({
          name: 'thinking',
          type: 'list',
          values: ['minimal', 'low', 'medium', 'high'],
          default: 'medium',
        });
      }
    }
    return args;
  },
};
