import { Placeholder } from "@tiptap/extension-placeholder";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.js";

const getPlaceholder = () => {
	const project = useMessagingStore.getState().project;
	return project ? project.title || "Untitled" : "(none)";
};

export const usePlaceholder = () => {
	return Placeholder.extend({
		onCreate() {
			// The editor outlives a project switch, and placeholders are only
			// redrawn on a selection or document change, so nudge one.
			const unsubscribe = useMessagingStore.subscribe((state, previous) => {
				if (state.project === previous.project) return;
				if (this.editor.isDestroyed) return;
				const { tr, selection } = this.editor.state;
				this.editor.view.dispatch(tr.setSelection(selection));
			});
			this.editor.on("destroy", unsubscribe);
		},
	}).configure({
		showOnlyWhenEditable: false,
		showOnlyCurrent: false,
		placeholder: getPlaceholder,
	});
};
