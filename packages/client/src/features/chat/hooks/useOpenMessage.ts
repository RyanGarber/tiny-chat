import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { ChatService } from "#client/features/chat/services/ChatService.ts";

/** Goes to a message, in whichever chat and branch it is on. */
export const useOpenMessage = () => {
	const client = useContext(ClientContext);

	const openMessage = useMutation({
		mutationKey: ["useOpenMessage", "openMessage"],
		mutationFn: (id: string) => ChatService.openMessage({ client, id }),
		onError: (error) => console.warn("Failed to open message", error),
	});

	return { openMessage };
};
