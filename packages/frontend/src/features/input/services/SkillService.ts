import { invoke, isTauriDesktop, trpc } from '@/utils/api';
import { shouldIncludeFile } from '@tiny-chat/backend/src/utils';
import type { zSkill } from '@tiny-chat/shared/src/types/skill.ts';
import { wrapSkill } from '@tiny-chat/shared/src/utils';

export const SkillService = {
  findLocal: async () => {
    const skills: (zSkill & { basePath: string })[] = [];

    console.log('local skills:', await isTauriDesktop());
    if (await isTauriDesktop()) {
      try {
        // TODO - move to rust
        const dirs = await invoke<string[]>('read_dir', { path: '~/.agents/skills' });
        for (const dir of dirs) {
          if (!(await invoke<boolean>('is_dir', { path: dir }))) continue;
          const walk = async (subdir: string) => {
            const files: { path: string[]; data: string }[] = [];
            const paths = await invoke<string[]>('read_dir', {
              path: subdir,
            });
            for (const path of paths) {
              const subpath = path
                .slice(dir.length)
                .split(/[\\/]+/g)
                .filter((p) => p.length);
              if (await invoke<boolean>('is_dir', { path: path })) {
                files.push(...(await walk(path)));
              } else {
                if (!shouldIncludeFile(subpath.join('/'))) continue;
                files.push({
                  path: subpath,
                  data: await invoke<string>('read_file', { path: path }),
                });
              }
            }
            return files;
          };
          const skill = wrapSkill(await walk(dir), { basePath: dir });
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
    const skills: (zSkill & { id: string })[] = [];

    const remoteSkills = await trpc.context.listSkills.query({ withResources: true });
    console.log('remote skills:', remoteSkills);
    for (const { id, files } of remoteSkills) {
      const skill = wrapSkill(files, { id });
      console.log('remote skill:', skill);
      skills.push(
        skill ?? {
          id,
          name: '',
          description: 'Error: unrecognized format',
          attributes: {},
          content: '',
          resources: [],
        },
      );
    }

    return skills;
  },
};
