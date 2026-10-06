import type { ClientInput } from "#client/features/chat/services/MessagingService.ts";
import { AtomUtils } from "#client/features/editor/utils/AtomUtils.ts";
import {
	insertNode,
	useEditorStore,
} from "#tui/features/editor/stores/useEditorStore.ts";
import { TextareaUtils } from "#tui/features/textarea/utils/TextareaUtils.ts";

/**
 * The terminal editor as the client's `input`, for whichever host runs it.
 *
 * The editor holds its commands, attachments and long pastes as atoms — short
 * stand-ins for the parts they travel as — which are cut back out here, and
 * written back in when a message is loaded for editing.
 */
export const EditorInputService = {
	getData: () => {
		const { content } = useEditorStore.getState();
		return [AtomUtils.toData({ content })];
	},
	setData: ({ data }) => {
		const content = AtomUtils.fromData(data);
		useEditorStore.setState({
			content,
			cursor: TextareaUtils.cursor(content, content.length),
			selection: null,
		});
	},
	insertNode: ({ node }) => insertNode(node),
} as const satisfies ClientInput;
