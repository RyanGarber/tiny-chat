import { useMutation, useQuery } from '@tanstack/react-query';
import { SkillService } from '../services/SkillService';
import { useMemo } from 'react';
import { trpc } from '@/utils/api';

export const localSkillFilesQueryKey = ['skills', 'local'] as const;
export const remoteSkillFilesQueryKey = ['skills', 'remote'] as const;

export const useSkills = () => {
  const localSkills = useQuery({
    queryKey: localSkillFilesQueryKey,
    queryFn: () => SkillService.findLocal(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const remoteSkills = useQuery({
    queryKey: remoteSkillFilesQueryKey,
    queryFn: () => SkillService.findRemote(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const deleteRemoteSkill = useMutation({
    mutationFn: (id: string) => trpc.input.deleteFiles.mutate({ type: 'skill', id }),
    onSuccess: () => {
      void remoteSkills.refetch();
    },
  });

  const skills = useMemo(() => {
    return [...(localSkills.data ?? []), ...(remoteSkills.data ?? [])];
  }, [localSkills.data, remoteSkills.data]);

  return { localSkills, remoteSkills, deleteRemoteSkill, skills };
};
