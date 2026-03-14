import type { Model, zGenerateOutput } from '../../types.ts';
import type { ChatProvider } from './index.ts';

export const Debug: ChatProvider = {
  name: 'debug',
  settings: [],

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels(_session) {
    return [
      { name: 'tool-sim', features: ['generate' as const], args: [] } satisfies Model,
      { name: 'text-sim', features: ['generate' as const], args: [] } satisfies Model,
    ];
  },

  async *generate(_session, _instruction, context, _config, _abortSignal, _tools) {
    const data: zGenerateOutput[] = [];

    if (_config.model === 'text-sim') {
      data.push({
        type: 'data',
        value: { type: 'text', value: 'This is a text generation simulation.' },
      });
      yield data[data.length - 1];
      return;
    }

    const result = context[context.length - 1].data.find((p) => p.type === 'toolResult');
    if (!result) {
      yield { type: 'data', value: { type: 'thought', value: 'Thinking evil thoughts' } };
      await new Promise((resolve) => setTimeout(resolve, 500));

      const words = 'Running a tool...'.match(/.{3}|.+$/gs)!;
      for (const word of words) {
        data.push({ type: 'data', value: { type: 'text', value: word } });
        yield data[data.length - 1];
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      data.push({
        type: 'data',
        value: {
          type: 'toolCall',
          name: 'ask_user',
          args: {
            question: 'What to do?',
            answers: ['Nothing', 'Just wait', 'Panic'],
          },
          id: 'debug-tool-call',
        },
      });
      yield data[data.length - 1];
    } else {
      data.push({
        type: 'data',
        value: {
          type: 'text',
          value: 'Check the output!',
        },
      });
      yield data[data.length - 1];
    }
    yield { type: 'special', value: { type: 'metadata', value: data } };
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async embed(_session, _texts, _config) {
    return [];
  },
};
