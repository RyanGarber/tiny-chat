import {
	createMessageStore,
	MessageStoreContext,
} from "@tiny-chat/client/features/message/stores/useMessageStore.ts";
import { expect, it } from "vitest";
import Text from "../../../core/components/Text.tsx";
import { render } from "../../../core/utils/RenderTestUtils.tsx";
import SourceTag from "./SourceTag.tsx";

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
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(screen.lastFrame()).toContain("Cited text");
		expect(screen.lastFrame()).toContain("📎");
		expect(screen.lastFrame()).not.toContain("❔");
	} finally {
		screen.unmount();
		screen.cleanup();
	}
});
