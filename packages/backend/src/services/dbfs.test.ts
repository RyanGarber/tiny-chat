import { beforeAll, describe, expect, inject, it } from 'vitest';
import { testTRPC } from '../tests.ts';
import { testToolContext } from '../tools/index.test.ts';
import { zToolContext } from '@tiny-chat/shared/src/types/tool.ts';
import { zShellExecInput, zShellExecOutput } from '@tiny-chat/shared/src/tools/system.ts';
import { ShellExec } from '../tools/chat.ts';

const trpc = testTRPC();

describe('services - dbfs', () => {
  let upload: Awaited<ReturnType<(typeof trpc)['input']['createUpload']['mutate']>>;
  let context: zToolContext;

  beforeAll(async () => {
    const data = new FormData();
    data.set('type', 'ATTACHMENT');
    data.set('file', new File(['Files suck. I hate files.'], 'question.md'));
    upload = await trpc.input.createUpload.mutate(data);
    const message = await trpc.message.create.mutate({
      author: 'USER',
      config: inject('backend_config'),
      data: [[upload]],
      metadata: [],
    });
    const chat = await trpc.chat.find.query({ messageId: message.id });
    context = testToolContext(chat!, [message]);
  });

  it('finds the upload in `ls -l`', async () => {
    const output = await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: 'ls -l',
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect((output[0].value as zShellExecOutput).stdout).toContain(upload.id);
  });

  it('finds the uploaded file in `ls -l`', async () => {
    const output = await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: `ls -l ${upload.id}`,
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect((output[0].value as zShellExecOutput).stdout).toContain('question.md');
  });

  it('writes a file to the chat', async () => {
    await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: `echo "Hello, world!" > /mnt/chat/hello.txt`,
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    const output = await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: `cat /mnt/chat/hello.txt`,
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    expect((output[0].value as zShellExecOutput).stdout).toBe('Hello, world!\n');
  });

  it('runs a python script', async () => {
    const output = await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: `python3 -c "import os; print(os.getcwd()); f = open('hello.txt', 'w'); f.write('Hello, world!'); f.close()"`,
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    expect.assert(output[0].type === 'json');
    console.log(output[0].value);
    expect((output[0].value as zShellExecOutput).stdout).toContain('/mnt/chat');

    const output2 = await trpc.input.callTool.mutate({
      name: ShellExec.name,
      context,
      input: {
        command: 'cat /mnt/chat/hello.txt',
        chat: true,
      } satisfies zShellExecInput,
      userInput: undefined,
    });
    expect.assert(output2[0].type === 'json');
    console.log(output2[0].value);
    expect((output2[0].value as zShellExecOutput).stdout).toContain('Hello, world!');
  });
});
