import { describe, expect, it } from 'vitest';
import { testTRPC } from '../tests.ts';
import { ListActions, zListActionsInput, zListActionsOutput } from './actions.ts';
import { testToolContext } from './index.test.ts';
import { workerTestPrompt } from '../services/worker.test.ts';

describe('tools - actions', () => {
  const trpc = testTRPC();

  it('lists actions', async () => {
    const output = await trpc.input.callTool.mutate({
      name: ListActions.name,
      context: testToolContext(),
      input: {
        active_only: true,
      } satisfies zListActionsInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    const actions = (output[0].value as zListActionsOutput).filter(
      (a) => a.prompt !== workerTestPrompt,
    );
    expect(actions).toHaveLength(0);
  });
});
