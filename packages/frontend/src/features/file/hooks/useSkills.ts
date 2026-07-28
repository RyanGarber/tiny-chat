import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { query } from "#frontend/utils/api.ts";
import { SkillService } from "../../config/services/SkillService.ts";

export const localSkillFilesQueryKey = ["skills", "local"] as const;
const remoteSkillFilesQueryKey = ["skills", "remote"] as const;

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
		...query.upload.deleteUpload.mutationOptions(),
		onSuccess: () => {
			void remoteSkills.refetch();
		},
	});

	const skills = useMemo(() => {
		return [...(localSkills.data ?? []), ...(remoteSkills.data ?? [])];
	}, [localSkills.data, remoteSkills.data]);

	return { localSkills, remoteSkills, deleteRemoteSkill, skills };
};
