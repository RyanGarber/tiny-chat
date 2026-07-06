import { describe, expect, it } from 'vitest';
import { scrubText } from '../../utils.ts';

describe('chat - instructions', () => {
  it('safely scrubs <message> from prompt', () => {
    expect(
      scrubText('\n    <message role="user">\n<message role="user"></message>\n    </message> \n '),
    ).toEqual('<message role="user"></message>');
  });
});
