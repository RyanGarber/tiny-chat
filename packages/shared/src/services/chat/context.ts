import type { GenerationCallbacks } from './generate.ts';
import type { FileSearchResult, zContextItem } from '../../types/chat.ts';
import { Author, type zDataPart, type zGenerateInput } from '../../types/chat.ts';
import { getLastPrompt, normalizeText, snippetText, texts } from '../../utils.ts';
import type { zUser } from '../../types/user.ts';
import { buildGenerationInstructions } from './instructions.ts';
import type { zToolGroup } from '../../types/tool.ts';
import type { zSkill } from '../../types/skill.ts';
import type { File } from '../../../../backend/generated/prisma/client.ts';
import { format } from 'timeago.js';

export async function buildContext(
  user: zUser,
  callbacks: GenerationCallbacks,
  input: zGenerateInput,
  toolGroups: zToolGroup[],
  skills: zSkill[],
) {
  console.log('[Context] input context:', input.context);

  const prompt = getLastPrompt(input.context);
  const promptText = texts(prompt.data);
  const promptEmbedding = prompt.id
    ? await callbacks.getEmbedding({ messageId: prompt.id })
    : await callbacks.embed(promptText);

  const context: zContextItem[] = await Promise.all(
    input.context.map(async (m, i) => {
      let isFirstText = true;

      const uploadFiles: Record<string, File[]> = {};
      const uploadFileContexts: Record<string, FileSearchResult[]> = {};
      for (const upload of m.data
        .flat()
        .filter((d): d is Extract<zDataPart, { type: 'upload' }> => d.type === 'upload')) {
        uploadFiles[upload.id] = await callbacks.listUploadFiles(upload.id);
        uploadFileContexts[upload.id] = await callbacks.searchFiles(
          m.data.flat().flatMap((p) => (p.type === 'upload' ? [p.id] : [])),
          promptText,
          promptEmbedding ?? undefined,
          3,
        );
      }

      return {
        ...m,
        data: m.data.map((d) =>
          d.flatMap((p): zDataPart[] => {
            if (p.type === 'upload') {
              console.log(`[Context] handling ${p.name} (${uploadFiles[p.id]?.length ?? 0} files)`);
              if (uploadFiles[p.id]?.length === 1) {
                const bytes = Array.from(uploadFiles[p.id][0].data, (byte) =>
                  String.fromCodePoint(byte),
                ).join('');
                return [
                  { type: 'text', value: `Uploaded file (${p.name}):` },
                  {
                    type: 'inputFile',
                    name: uploadFiles[p.id][0].path[0],
                    mime: uploadFiles[p.id][0].mime,
                    data: btoa(bytes),
                  },
                ];
              } else if (uploadFiles[p.id]?.length) {
                const buildFileTreeMarkdown = (files: (typeof uploadFiles)[string]) => {
                  const tree: Record<string, unknown> = {};

                  for (const file of files) {
                    let node = tree;
                    for (let i = 0; i < file.path.length - 1; i++) {
                      const segment = file.path[i];
                      node[segment] ??= {};
                      node = node[segment] as Record<string, unknown>;
                    }
                    const filename = file.path[file.path.length - 1];
                    node[filename] = null; // leaf = file
                  }

                  const renderTree = (node: Record<string, unknown>, prefix = ''): string => {
                    const entries = Object.entries(node);
                    return entries
                      .map(([name, children], i) => {
                        const isLast = i === entries.length - 1;
                        const connector = isLast ? '└── ' : '├── ';
                        const childPrefix = prefix + (isLast ? '    ' : '│   ');
                        if (children === null) {
                          return `${prefix}${connector}${name}`;
                        }
                        const subtree = renderTree(
                          children as Record<string, unknown>,
                          childPrefix,
                        );
                        return `${prefix}${connector}${name}/\n${subtree}`;
                      })
                      .join('\n');
                  };

                  return '```\n' + renderTree(tree) + '\n```';
                };
                const treeMarkdown = buildFileTreeMarkdown(uploadFiles[p.id]);
                const snippets = uploadFileContexts[p.id]
                  .map((f) => snippetText(new TextDecoder().decode(f.data), promptText, 2500))
                  .join('\n\n---\n\n');
                console.log('[Context] upload files:', treeMarkdown, snippets);
                return [
                  {
                    type: 'text',
                    value: `Relevant files from upload (${p.name}):\n${treeMarkdown}\n\n---${snippets}`,
                  },
                ];
              }
            }
            if (p.type === 'text') {
              let value = normalizeText(p.value).replace(/((?:^::>:: .*$\n?)+)/gm, (block) => {
                const lines = block
                  .trim()
                  .split('\n')
                  .map((l) => l.replace(/^::>:: /, ''));
                let referencedModel = '';
                let contentLines = lines;
                if (lines[0].startsWith('::model=') && lines[0].endsWith('::')) {
                  referencedModel = lines[0].slice('::model='.length, -2);
                  contentLines = lines.slice(1);
                }
                const prefix = referencedModel
                  ? `Earlier, ${referencedModel === input.config.model ? 'you' : referencedModel} said:\n`
                  : '';
                return prefix + contentLines.map((l) => `> ${l}`).join('\n') + '\n';
              });
              if (isFirstText && m.id) {
                let heading;
                if (m.author === Author.USER) {
                  heading = `[user]\n`;
                  if (i !== 0) {
                    const previous = input.context[i - 1];
                    if (m.createdAt && previous?.createdAt) {
                      const delay = format(previous.createdAt, undefined, {
                        relativeDate: m.createdAt,
                      }).replace(' ago', '');
                      if (delay !== 'just now') {
                        heading += `[info: conversation timing: ${delay} ${delay.endsWith('s') ? 'have' : 'has'} passed since the last message.]\n`;
                      }
                    }
                  }
                } else {
                  heading = `[assistant${m.config ? `:model=${m.config?.model}` : ''}]\n`;
                }
                value = heading + '\n' + value;
                isFirstText = false;
              }
              return [{ ...p, value }];
            }
            return [p];
          }),
        ),
      };
    }),
  );

  console.log('[Context] final context:', context);

  const instructions = await buildGenerationInstructions(
    user,
    callbacks,
    input,
    context,
    toolGroups,
    skills,
  );

  console.log('[Context] final instructions:', instructions);

  return { context, instructions };
}
