import { useMutation, useQuery } from "@tanstack/react-query";
import clipboard from "clipboardy";
import { client } from "../../client.ts";
import { KeyringService } from "../services/KeyringService.ts";
import { useStatusStore } from "../stores/useStatusStore.ts";
import { CommonUtils } from "../utils/CommonUtils.ts";

export const useSession = () => {
	const setStatus = useStatusStore((state) => state.setStatus);
	const unsetStatus = useStatusStore((state) => state.unsetStatus);

	const session = useQuery({
		queryKey: ["session"] as const,
		queryFn: async () => {
			let session = await client.auth.getSession();
			if (session.error) throw session.error;
			if (!session.data) {
				const signIn = await client.auth.signIn.anonymous();
				if (signIn.data?.token) {
					KeyringService.setSessionToken(signIn.data.token);
					session = await client.auth.getSession();
					if (session.error) throw session.error;
				} else {
					throw new Error("Failed to sign in anonymously");
				}
			}
			return session.data;
		},
	});

	const cloneSession = useMutation({
		mutationKey: ["session", "clone"] as const,
		mutationFn: async () => {
			setStatus({ id: "clone" });
			const id = await client.api.user.createClone.mutate();
			await clipboard.write(`${CommonUtils.webUrl}/#?clone=${id}`);
			setStatus({ id: "clone", text: "Waiting for you to sign in..." });
			while (true) {
				const result = await client.api.user.completeClone.mutate({ id });
				if (result) break;
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
			setStatus({ id: "clone" });
			await session.refetch();
			unsetStatus({ id: "clone" });
		},
	});

	return {
		session,
		cloneSession,
	};
};
