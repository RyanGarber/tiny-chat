import { beforeAll, describe, expect, inject, it } from 'vitest';
import { testTRPC } from '../tests.ts';
import { testToolContext } from './index.test.ts';
import { zToolContext } from '@tiny-chat/shared/src/types/tool.ts';
import {
  zListFilesInput,
  zListFilesOutput,
  zSearchFilesInput,
  zSearchFilesOutput,
} from '@tiny-chat/shared/src/tools/system.ts';
import { ListFiles, SearchFiles } from './system.ts';

describe('tools - system', () => {
  const trpc = testTRPC();
  let upload: Awaited<ReturnType<(typeof trpc)['input']['createUpload']['mutate']>>;
  let context: zToolContext;

  beforeAll(async () => {
    const data = new FormData();
    data.set('type', 'ATTACHMENT');
    data.set('file', new File(['Files suck. I hate files.'], 'question.md'));
    upload = await trpc.input.createUpload.mutate(data);
    context = testToolContext(undefined, [
      {
        id: '1',
        author: 'USER',
        config: inject('backend_config'),
        data: [[upload]],
        createdAt: new Date(),
      },
    ]);
  });

  it('lists files at the root of the upload', async () => {
    const output = await trpc.input.callTool.mutate({
      name: ListFiles.name,
      context,
      input: { path: `/mnt/chat/${upload.id}` } satisfies zListFilesInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect((output[0].value as zListFilesOutput).files[0]).toEqual(
      `/mnt/chat/${upload.id}/question.md`,
    );
  });

  it('semantic searches for the uploaded file', async () => {
    const output = await trpc.input.callTool.mutate({
      name: SearchFiles.name,
      context,
      input: { path: `/mnt/chat`, query: 'files', mode: 'semantic' } satisfies zSearchFilesInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect(output[0].value as zSearchFilesOutput).toHaveLength(1);
  });

  it('semantic searches for a nonexistent file', async () => {
    const output = await trpc.input.callTool.mutate({
      name: SearchFiles.name,
      context,
      input: {
        path: `/mnt/chat`,
        query: 'xxxxxxxxxx',
        mode: 'semantic',
      } satisfies zSearchFilesInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect(output[0].value as zSearchFilesOutput).toHaveLength(0);
  });

  it('regex searches for the uploaded file', async () => {
    const output = await trpc.input.callTool.mutate({
      name: SearchFiles.name,
      context,
      input: {
        path: `/mnt/chat`,
        query: '(\\W[files]{5}\\W)',
        mode: 'regex',
      } satisfies zSearchFilesInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect(output[0].value as zSearchFilesOutput).toHaveLength(1);
  });

  it('regex searches for the uploaded file outside of the upload', async () => {
    const output = await trpc.input.callTool.mutate({
      name: SearchFiles.name,
      context,
      input: {
        path: `/mnt/chat/fakepath`,
        query: '.*',
        mode: 'regex',
      } satisfies zSearchFilesInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect(output[0].value as zSearchFilesOutput).toHaveLength(0);
  });
});
