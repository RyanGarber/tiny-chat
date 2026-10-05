import { useConfig } from "@tiny-chat/client/features/agent/hooks/useConfig.ts";
import ConfigEditor from "./ConfigEditor.tsx";

/** The config the next message is sent with, opened by `/config`. */
export default function ChatConfig() {
	const { config, setConfig } = useConfig();
	return <ConfigEditor config={config} setConfig={setConfig} />;
}
