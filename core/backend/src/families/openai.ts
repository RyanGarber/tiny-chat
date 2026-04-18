import type { Family } from './index.ts';
import { getCommonArgs } from '../utils/consts.ts';
import type { ModelArg } from '../types.ts';

export const OpenAIFamily: Family = {
  getArgs(model) {
    const args: ModelArg[] = [];
    if (['gpt-', 'o1', 'o3', 'o4'].some((m) => model.includes(m))) {
      const isReasoning = ['gpt-5', 'gpt-4o', 'o1', 'o3', 'o4'].some((m) => model.includes(m));
      args.push(...getCommonArgs(isReasoning ? -1 : 2));
      if (isReasoning) {
        args.push({
          name: 'reasoning',
          type: 'list',
          values: ['off', 'low', 'medium', 'high'],
          default: 'medium',
        });
      }
    }
    return args;
  },
};
