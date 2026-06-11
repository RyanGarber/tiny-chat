import { fileTypeFromBuffer } from 'file-type';
import { Prisma, type File } from '../../generated/prisma/client.ts';
import { createId } from '@paralleldrive/cuid2';
import { shouldIncludeFile } from '../utils.ts';
import { unzip, type Unzipped } from 'fflate';
import sharp from 'sharp';
import { MarkItDown } from 'markitdown-ts';
import type { zUser } from '@tiny-chat/shared/src/types/user.ts';

export async function handleFilesZipped(
  user: zUser,
  zip: ArrayBuffer,
  existingFiles: File[] = [],
  associate: { uploadId: string } | { skillId: string },
  include?: (path: string) => boolean,
) {
  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    unzip(new Uint8Array(zip), (err, data) => {
      if (err) {
        reject(new Error(`Failed to unzip zip: ${err.message}`));
      } else {
        console.log(`Unzipped zip with ${Object.keys(data).length} files`);
        resolve(data);
      }
    });
  });

  const files = Object.entries(unzipped).filter(([path]) => shouldIncludeFile(path, false));

  return await handleFiles(
    user,
    files.map(([name, data]) => [name, data.buffer]),
    existingFiles,
    associate,
    include,
  );
}

export async function handleFiles(
  user: zUser,
  files: [string, ArrayBufferLike][],
  existingFiles: File[] = [],
  associate: { uploadId: string } | { skillId: string },
  include?: (path: string) => boolean,
) {
  const toCreate: { path: string[]; mime: string; data: Uint8Array }[] = [];
  const toUpdate: { id: string; data: Uint8Array; mime: string }[] = [];
  const paths = new Set<string>();
  const preprocessing = new Map<string, { text?: string; thumbnail?: string }>();

  const existingFilesMap = new Map(existingFiles.map((f) => [f.path.join('/'), f]));

  for (const [rawPath, content] of files) {
    if (include && !include(rawPath)) {
      console.log(`Skipping file ${rawPath} because it does not match the include criteria`);
      continue;
    }

    console.log(`Processing file ${rawPath}`);

    const pathParts = rawPath.split('/');
    const pathKey = pathParts.join('/');
    paths.add(pathKey);

    const existingFile = existingFilesMap.get(pathKey);

    const { data, mime, text, thumbnail } = await preprocessFile(
      Buffer.from(content),
      pathParts[pathParts.length - 1],
      undefined,
    );
    console.log(`Preprocessed file ${rawPath} with ${data.length} bytes of ${mime}`, text);

    if (!existingFile) {
      toCreate.push({ path: pathParts, mime, data });
    } else {
      // Compare binary data
      const isChanged = Buffer.compare(Buffer.from(existingFile.data), Buffer.from(content)) !== 0;
      if (isChanged) {
        toUpdate.push({ id: existingFile.id, data, mime });
      }
    }

    preprocessing.set(pathKey, { text, thumbnail });
  }

  const toDelete = existingFiles.filter((f) => !paths.has(f.path.join('/'))).map((f) => f.id);

  console.log(
    `Incremental sync: ${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`,
  );

  const result = await globalThis.prisma.$transaction([
    ...toCreate.map((f) =>
      globalThis.prisma.file.create({
        data: {
          id: createId(),
          userId: user.id,
          ...associate,
          path: f.path,
          mime: f.mime,
          data: new Uint8Array(f.data),
        },
      }),
    ),
    ...toUpdate.map((f) =>
      globalThis.prisma.file.update({
        where: { id: f.id },
        data: {
          data: new Uint8Array(f.data),
          mime: f.mime,
        },
      }),
    ),
    ...toDelete.map((id) =>
      globalThis.prisma.file.delete({
        where: { id },
      }),
    ),
  ]);

  if (toUpdate.length > 0) {
    await globalThis.prisma
      .$executeRaw`UPDATE file SET embedding = NULL WHERE id IN (${Prisma.join(toUpdate.map((u) => u.id))})`;
  }

  return result.map((f) => ({ ...f, ...preprocessing.get(f.path.join('/')) }));
}

export async function preprocessFile(data: Buffer, filename?: string, mimeType?: string) {
  let text: string | undefined = undefined;
  let thumbnail: string | undefined;
  let mime = (await fileTypeFromBuffer(data))?.mime ?? mimeType ?? 'application/octet-stream';

  console.log(`Preprocessing file ${filename} with mime ${mime}`);
  if (mime.startsWith('image/')) {
    try {
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
    } catch (e) {
      console.error(e);
      throw e;
    }
  } else if (
    (mime.includes('officedocument') ||
      mime.includes('msword') ||
      mime.includes('ms-excel') ||
      mime.includes('ms-powerpoint')) &&
    filename
  ) {
    try {
      const parsed = await new MarkItDown().convertBuffer(data, {
        file_extension: filename.slice(filename.lastIndexOf('.')),
      });
      data = Buffer.from(parsed!.markdown);
      text = parsed!.markdown;
      mime = 'text/plain';
      console.log(`Extracted text:`, text);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  return { data, mime, text, thumbnail };
}
