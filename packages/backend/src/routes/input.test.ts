import { describe, expect, inject, it } from 'vitest';
import { testTRPC } from '../tests.ts';
import { WriteFile } from '../tools/chat.ts';
import { testToolContext } from '../tools/index.test.ts';
import { zWriteFileInput } from '@tiny-chat/shared/src/tools/system.ts';

describe('routes - input', () => {
  const trpc = testTRPC();

  it('applies a chat file over a base file', async () => {
    const data = new FormData();
    data.set('type', 'ATTACHMENT');
    data.set('file', new File(['uploadFile1'], 'uploadFile1.txt'));
    const upload1 = await trpc.input.createUpload.mutate(data);

    data.set('file', new File(['uploadFile2'], 'uploadFile2.txt'));
    const upload2 = await trpc.input.createUpload.mutate(data);

    const message = await trpc.message.create.mutate({
      author: 'USER',
      config: inject('backend_config'),
      data: [[upload1]],
      metadata: [],
    });
    const chat = (await trpc.chat.find.query({ messageId: message.id }))!;

    await trpc.input.callTool.mutate({
      name: WriteFile.name,
      context: testToolContext(chat, [message]),
      input: {
        path: `/mnt/chat/${upload1.id}/uploadFile1.txt`,
        content: 'uploadFile1\nnewline',
      } satisfies zWriteFileInput,
      userInput: undefined,
    });

    await trpc.input.callTool.mutate({
      name: WriteFile.name,
      context: testToolContext(chat, [message]),
      input: {
        path: `/mnt/chat/file1.txt`,
        content: 'file1\nnewline',
      } satisfies zWriteFileInput,
      userInput: undefined,
    });

    let files = await trpc.input.listAllFilesInChat.query({
      chatId: chat.id,
      uploadIds: [upload1.id],
    });

    expect(files['']?.length).toBeTruthy();
    expect(files[upload1.id]?.length).toBeTruthy();

    const uploadFile1 = files[upload1.id].find((f) =>
      f.uploadFile?.path.includes('uploadFile1.txt'),
    );

    console.log(JSON.stringify(uploadFile1));
    console.log(
      await trpc.input.findFileInChat.query({
        chatId: chat.id,
        uploadId: upload1.id,
        path: ['uploadFile1.txt'],
      }),
    );
    expect.assert(uploadFile1?.file && uploadFile1?.uploadFile);
    expect(uploadFile1.file.lines).toBe(2);
    expect(uploadFile1.uploadFile.lines).toBe(1);

    const file1 = files[''].find((f) => f.file?.path.includes('file1.txt'));
    expect.assert(file1?.file && !file1?.uploadFile);
    expect(file1.file.lines).toBe(2);

    files = await trpc.input.listAllFilesInChat.query({
      chatId: undefined,
      uploadIds: [upload2.id],
    });
    console.log(files);

    expect(files['']?.length).toBeTruthy();
    const uploadFile2 = files[''].find((f) => f.uploadFile?.path.includes('uploadFile2.txt'));
    expect.assert(!uploadFile2?.file && uploadFile2?.uploadFile);
    expect(uploadFile2.uploadFile.lines).toBe(1);
  });
});
