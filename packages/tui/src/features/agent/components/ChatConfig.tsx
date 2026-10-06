import { useConfig } from "#client/features/agent/hooks/useConfig.ts";
import ConfigEditor from "#tui/features/agent/components/ConfigEditor.tsx";

/** The config the next message is sent with, opened by `/config`. */
export default function ChatConfig() {
	const { config, setConfig } = useConfig();
	return <ConfigEditor config={config} setConfig={setConfig} />;
}
