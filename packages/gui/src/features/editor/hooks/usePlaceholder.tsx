import { Placeholder } from "@tiptap/extension-placeholder";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";

const getPlaceholder = () => {
	const project = useChatStore.getState().active.project;
	return project ? project.title || "Untitled" : "(none)";
};

export const usePlaceholder = () => {
	return Placeholder.extend({
		onCreate() {
			// The editor outlives a project switch, and placeholders are only
			// redrawn on a selection or document change, so nudge one.
			const unsubscribe = useChatStore.subscribe(
				(state) => state.active.project,
				() => {
					if (this.editor.isDestroyed) return;
					const { tr, selection } = this.editor.state;
					this.editor.view.dispatch(tr.setSelection(selection));
				},
			);
			this.editor.on("destroy", unsubscribe);
		},
	}).configure({
		showOnlyWhenEditable: false,
		showOnlyCurrent: false,
		placeholder: getPlaceholder,
	});
};
