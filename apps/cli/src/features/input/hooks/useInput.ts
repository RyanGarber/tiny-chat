import { useMutation } from "@tanstack/react-query";
import { InputService } from "../services/InputService.ts";

export const useInput = () => {
	const send = useMutation({
		mutationKey: ["send"] as const,
		mutationFn: async () => {
			const data = InputService.getData();
			console.log("sending", data);
		},
	});

	return { send };
};
