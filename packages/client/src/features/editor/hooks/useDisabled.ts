import { useIsMutating } from "@tanstack/react-query";
import {
	deleteMessageMutationKey,
	sendMessageMutationKey,
} from "../../chat/hooks/useMessaging.ts";
export const useDisabled = ({ disabled }: { disabled: boolean }) => {
	const sending = useIsMutating({ mutationKey: sendMessageMutationKey }) > 0;
	const deleting = useIsMutating({ mutationKey: deleteMessageMutationKey }) > 0;
	return { disabled: disabled || sending || deleting };
};
