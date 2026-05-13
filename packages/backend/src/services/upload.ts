import type { IncomingMessage, ServerResponse } from 'http';
import { createId } from '@paralleldrive/cuid2';
import busboy from 'busboy';
import { buffer } from 'stream/consumers';
import { MAX_FILE_SIZE } from '@tiny-chat/shared/src/utils.ts';
import { type zUploadOutput } from '@tiny-chat/shared/src/types/chat.ts';
import { auth, authHeaders } from './auth.ts';
import { handleFiles, handleFilesZipped } from './files.ts';

export default async function uploadHandler(req: IncomingMessage, res: ServerResponse) {
  const session = await auth.api.getSession({ headers: authHeaders(req.headers) });
  if (!session?.user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const userId = session.user.id;
    const uploaded: zUploadOutput = [];
    const tooLarge = false;

    const type = req.headers['x-upload-type'] as 'upload' | 'skill';
    if (!type) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing upload type' }));
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_FILE_SIZE },
        defParamCharset: 'utf8',
      });

      const uploads: Promise<void>[] = [];

      bb.on('file', (_, stream, info) => {
        console.log(`Receiving file: ${info.filename}`);
        uploads.push(
          new Promise((resolve) => {
            void (async () => {
              console.log(`Preparing to handle upload: ${info.filename}`);
              const id = createId();

              let associate: { uploadId: string } | { skillId: string };
              if (type === 'upload') {
                associate = { uploadId: id };
                await globalThis.prisma.upload.create({
                  data: {
                    id,
                    user: { connect: { id: userId } },
                    name: info.filename,
                  },
                });
              } else if (
                type === 'skill' &&
                (info.filename === 'SKILL.md' || info.filename.endsWith('.zip'))
              ) {
                // TODO - incrementally update baased on matching name in frontmatter
                associate = { skillId: id };
                await globalThis.prisma.skill.create({
                  data: {
                    id,
                    user: { connect: { id: userId } },
                  },
                });
              } else {
                throw new Error(`Invalid upload type: ${type as string}`);
              }

              let files: Awaited<ReturnType<typeof handleFiles>>;
              if (info.filename.endsWith('.zip')) {
                files = await handleFilesZipped(
                  session.user,
                  (await buffer(stream)).buffer,
                  [],
                  associate,
                );
              } else {
                files = await handleFiles(
                  session.user,
                  [[info.filename, await buffer(stream)]],
                  [],
                  associate,
                );
              }

              const thumbnail = files.find((f) => !!f.thumbnail)?.thumbnail;

              console.log(
                `Saving files:`,
                files.map((f) => ({
                  path: f.path.join('/'),
                  mime: f.mime,
                  size: f.data.length,
                  thumbnail: f.thumbnail?.length ?? -1,
                })),
                `Associated thumbnail: ${thumbnail?.length ?? -1} bytes`,
              );

              if (type === 'upload') {
                await globalThis.prisma.upload.update({
                  where: { id },
                  data: {
                    thumbnail,
                  },
                });
              }

              uploaded.push({
                type: 'upload',
                id,
                name: info.filename,
                thumbnail,
              });

              resolve();
            })();
          }),
        );
      });

      bb.on('finish', () => {
        Promise.all(uploads)
          .then(() => resolve())
          .catch(reject);
      });
      bb.on('error', reject);

      req.pipe(bb);
    });

    if (tooLarge) {
      res.end('error: file too large');
      return;
    }

    res.end(`data: ${JSON.stringify(uploaded)}`);
  } catch (e: unknown) {
    console.error('Upload error:', e);
    res.end('error: upload failed');
  }
}
