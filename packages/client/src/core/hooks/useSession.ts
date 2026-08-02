import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext, useEffect } from "react";
import { ClientProvider } from "../../client.ts";

const sessionQueryKey = ["useSession"] as const;

export const useSession = ({
	setToken,
}: {
	setToken?: string | null | undefined;
} = {}) => {
	const client = useContext(ClientProvider);

	const session = useQuery({
		queryKey: sessionQueryKey,
		queryFn: async () => {
			let _session = await client.auth.getSession();
			if (_session.error) throw _session.error;

			if (!_session.data) {
				console.log("[useSession] no session, signing in anonymously...");
				const signIn = await client.auth.signIn.anonymous();
				if (signIn.data?.token) {
					client.setToken(signIn.data.token);
					_session = await client.auth.getSession();
					if (_session.error || !_session.data) {
						throw _session.error ?? new Error("missing session data");
					}
				} else {
					throw new Error("anonymous sign-in failed");
				}
			}

			client.setToken(_session.data.session.token);

			console.log("[useSession] session:", _session.data.user.id);
			return _session.data;
		},
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	useEffect(() => {
		if (setToken) {
			client.setToken(setToken);
			void client.queryClient.invalidateQueries({ queryKey: sessionQueryKey });
		}
	}, [setToken, client.queryClient, client.setToken]);

	const requestClone = useMutation({
		mutationKey: ["useSession", "requestClone"] as const,
		mutationFn: async (onReady: (url: string) => Promise<void> | void) => {
			console.log("[useSession] requesting clone");

			const id = await client.api.user.createClone.mutate();
			void onReady(id);

			while (true) {
				const result = await client.api.user.completeClone.mutate({ id });
				if (result) break;
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			void client.queryClient.invalidateQueries({ queryKey: sessionQueryKey });
		},
	});

	const acceptClone = useMutation({
		mutationKey: ["useSession", "acceptClone"] as const,
		mutationFn: async (id: string) => {
			console.log("[useSession] accepting clone:", id);
			await client.api.user.continueClone.mutate({ id });
		},
	});

	return {
		session,
		requestClone,
		acceptClone,
	};
};
