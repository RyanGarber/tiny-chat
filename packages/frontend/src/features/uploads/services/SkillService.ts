import { invoke, isTauriDesktop, trpc } from '@/utils/api';
import type { zSkill } from '@tiny-chat/shared/src/types/skill.ts';
import { wrapSkill } from '@tiny-chat/shared/src/utils';
import {
  decodeTextLossy,
  isTextAdjacent,
  mimeType,
  toChatUri,
} from '@tiny-chat/shared/src/utils/files.ts';

export const SkillService = {
  findLocal: async () => {
    const skills: zSkill[] = [];

    console.log('local skills:', await isTauriDesktop());
    if (await isTauriDesktop()) {
      try {
        const dirs = await invoke<string[]>('list_files', { path: '~/.agents/skills' });
        for (const dir of dirs) {
          if (!(await invoke<boolean>('is_dir', { path: dir }))) continue;
          const walk = async (subdir: string) => {
            const files: { path: string[]; data: string }[] = [];
            const paths = await invoke<string[]>('list_files', {
              path: subdir,
            });
            for (const path of paths) {
              const subpath = path
                .slice(dir.length)
                .split(/[\\/]+/g)
                .filter((p) => p.length);
              if (await invoke<boolean>('is_dir', { path })) {
                files.push(...(await walk(path)));
              } else {
                // TODO - do we need to keep any of this?
                const data = await invoke<string>('read_file', { path });
                const mime = await mimeType(data, path);
                if (!isTextAdjacent(mime)) continue;
                files.push({
                  path: subpath,
                  data: decodeTextLossy(data, mime),
                });
              }
            }
            return files;
          };
          const skill = wrapSkill(dir, await walk(dir));
          if (skill) skills.push(skill);
        }
      } catch (error) {
        console.warn('error reading local skills:', error);
      }
    }

    console.log('local skills:', skills);
    return skills;
  },

  findRemote: async () => {
    const skills: zSkill[] = [];

    const remoteSkills = await trpc.input.listUploads.query({
      type: 'SKILL',
      includeFiles: { where: { path: { has: 'SKILL.md' } } },
    });
    console.log('remote skills:', remoteSkills);
    for (const { id, files } of remoteSkills.uploads) {
      const skill = wrapSkill(toChatUri(id), files);
      console.log('remote skill:', skill);
      skills.push(
        skill ?? {
          path: toChatUri(id),
          name: '',
          description: 'Error: unrecognized format',
          attributes: {},
        },
      );
    }

    return skills;
  },
};
