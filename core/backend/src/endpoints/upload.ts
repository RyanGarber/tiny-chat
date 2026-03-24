import type { IncomingMessage, ServerResponse } from 'http';
import { createId } from '@paralleldrive/cuid2';
import busboy from 'busboy';
import { auth, toHeaders } from '../server.ts';
import { fileTypeFromBuffer } from 'file-type';
import { buffer } from 'stream/consumers';
import { type zUploadOutput, MAX_FILE_SIZE } from '../types.ts';
import sharp from 'sharp';
import { embed } from '../utils/embed.ts';
import { MarkItDown } from 'markitdown-ts';
import { embedGitHubFile } from '../utils/consts.ts';

export default async function uploadHandler(req: IncomingMessage, res: ServerResponse) {
  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const userId = session.user.id;
    const uploaded: zUploadOutput = [];
    const tooLarge = false;

    await new Promise<void>((resolve, reject) => {
      const bb = busboy({
        headers: req.headers as Record<string, string | string[]>,
        limits: { fileSize: MAX_FILE_SIZE },
        defParamCharset: 'utf8',
      });

      const uploads: Promise<void>[] = [];

      bb.on('file', (_, stream, info) => {
        console.log(`Receiving file: ${info.filename}`);
        uploads.push(
          new Promise((resolve) => {
            void (async () => {
              let data = (await buffer(stream)) as Buffer;
              let text: string | null = null;
              let thumbnail: string | undefined;
              let mime = (await fileTypeFromBuffer(data))?.mime ?? info.mimeType;
              console.log(`Received ${data.length} bytes of ${mime}`);

              if (mime.startsWith('image/')) {
                mime = 'image/webp';
                data = await sharp(data, { failOn: 'none', animated: true })
                  .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                  .webp({ quality: 80 })
                  .toBuffer();
                thumbnail = `data:${mime};base64,${await sharp(data, { failOn: 'none' })
                  .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
                  .webp({ quality: 80 })
                  .toBuffer()
                  .then((buf) => buf.toString('base64'))}`;
                console.log(
                  `Optimized image size: ${data.length} bytes; thumbnail size: ${thumbnail.length} characters`,
                );
              } else if (
                mime.includes('officedocument') ||
                mime.includes('msword') ||
                mime.includes('ms-excel') ||
                mime.includes('ms-powerpoint')
              ) {
                const parsed = await new MarkItDown().convertBuffer(data, {
                  file_extension: info.filename.split('.').slice(-1)[0],
                });
                data = Buffer.from(parsed!.markdown);
                text = parsed!.markdown;
                mime = 'text/plain';
                console.log(`Extracted text length: ${text.length} characters`);
              }

              const upload = await prisma.upload.create({
                data: {
                  id: createId(),
                  user: { connect: { id: userId } },
                  name: info.filename,
                  thumbnail: thumbnail,
                  files: {
                    create: {
                      id: createId(),
                      user: { connect: { id: userId } },
                      path: [info.filename],
                      mime,
                      data: new Uint8Array(data),
                    },
                  },
                },
              });
              console.log(`Saved file record with ID: ${upload.id}`);

              uploaded.push({ type: 'upload', id: upload.id, name: info.filename, thumbnail });

              if (embedGitHubFile(info.filename)) {
                const textToEmbed = text ?? new TextDecoder().decode(data);
                const embeddings = await embed(session.user, [textToEmbed]);
                if (!embeddings) {
                  console.warn('Embedding failed for file:', upload.id);
                } else {
                  await prisma.$executeRaw`UPDATE file SET embedding = ${JSON.stringify(embeddings[0])}::vector WHERE id = ${upload.id}`;
                }
              }

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
