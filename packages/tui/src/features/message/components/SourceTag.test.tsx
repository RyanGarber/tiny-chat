import { expect, it } from "vitest";
import {
	createMessageStore,
	MessageStoreContext,
} from "#client/features/message/stores/useMessageStore.ts";
import Text from "#tui/core/components/Text.tsx";
import { render } from "#tui/core/utils/RenderTestUtils.tsx";
import SourceTag from "#tui/features/message/components/SourceTag.tsx";

it("renders cited text and updates its source references when sources settle", async () => {
	const store = createMessageStore();
	const screen = render(
		<MessageStoreContext value={store}>
			<Text>
				<SourceTag sources="/tmp/a file.txt">Cited text</SourceTag>
			</Text>
		</MessageStoreContext>,
	);
	try {
		expect(screen.lastFrame()).toContain("Cited text");
		expect(screen.lastFrame()).toContain("❔");
		store.setState({
			sources: [
				{
					key: "/tmp/a file.txt",
					type: "file",
					value: { path: "/tmp/a file.txt", directory: false },
				},
			],
		});
		await screen.idle();
		expect(screen.lastFrame()).toContain("Cited text");
		expect(screen.lastFrame()).toContain("📎");
		expect(screen.lastFrame()).not.toContain("❔");
	} finally {
		screen.unmount();
		screen.cleanup();
	}
});
