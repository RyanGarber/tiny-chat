import { beforeAll, describe, expect, it } from 'vitest';
import { testTRPC } from '../tests.ts';

describe('utils - files', () => {
  const trpc = testTRPC();

  beforeAll(async () => {
    const data = new FormData();
    data.set('type', 'ATTACHMENT');
    data.set('file', new File(['This should not be embedded.'], 'package-lock.json'));
    await trpc.input.createUpload.mutate(data);
    data.set('file', new File(['But this should.'], 'question.md'));
    await trpc.input.createUpload.mutate(data);
  });

  it('includes the correct files', async () => {
    const missingEmbeddings = await trpc.context.listMissingEmbeddings.query({});
    expect(
      missingEmbeddings!.files.find((file) => file.text === 'This should not be embedded.'),
    ).toBeUndefined();
    expect(missingEmbeddings!.files.find((file) => file.text === 'But this should.')).toBeDefined();
  });
});
