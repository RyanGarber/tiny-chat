import { useMutation } from "@tanstack/react-query";
import { useChat } from "../../chat/hooks/useChat.ts";
import { InputService } from "../services/InputService.ts";

export const useInput = () => {
	const { chat } = useChat();

	const send = useMutation({
		mutationKey: ["send"] as const,
		mutationFn: async () => {
			const data = InputService.getData();
			console.log("sending", data);
		},
	});

	return { send };
};
