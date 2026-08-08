import { Anchor, Pill, Stack, Text, Tooltip } from "@mantine/core";
import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { type CSSProperties, useContext } from "react";
import type { Components } from "streamdown";
import { format } from "timeago.js";
import {
	Attachment,
	Command,
	Quote,
} from "#app/core/components/Components.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";

const PILL_BASE: CSSProperties = {
	height: "auto",
	margin: "0 2px",
	padding: "2px 5.25px",
	fontSize: "0.7em",
	display: "inline-flex",
	cursor: "default",
	background: "var(--tc-interior)",
};

export const CiteComponent: Components["cite"] = ({ children, node }) => {
	const { sources } = useContext(MarkdownContext);
	const keys = ((node?.properties.sources ?? "") as string)
		.replace("user-content-", "")
		.split(/[\s;,]+/);

	return (
		<span>
			{children}
			{keys.map((key) => {
				const source = sources?.find(
					(source) => CommonUtils.getDistance(source.key, key) < 0.1,
				);
				return (
					<Tooltip
						key={key}
						multiline
						position="bottom"
						style={{ ...StyleUtils.glass, boxShadow: StyleUtils.shadow }}
						p="md"
						c="var(--mantine-color-text)"
						label={
							<Stack gap="xs" maw={300}>
								<Text size="sm" fw={500} lineClamp={2}>
									{source?.type === "memory" && source.value.fact}
									{source?.type === "action" &&
										DataUtils.getTextCleaned(source.value)}
									{source?.type === "web" &&
										(source.value.title ??
											PathUtils.name({ path: source.value.url }))}
									{source?.type === "file" && PathUtils.name(source.value.uri)}
								</Text>
								<Text size="xs" c="dimmed">
									{source?.type === "memory" &&
										`Learned ${format(source.value.createdAt)}`}
									{source?.type === "action" &&
										(source.value.nextRunAt
											? `Next run ${format(source.value.nextRunAt)}`
											: "All runs completed")}
									{source?.type === "web" && (
										<Anchor
											lineClamp={1}
											href={source.value.url}
											target="_blank"
											onClick={(e) => {
												e.preventDefault();
												void TauriUtils.open(source?.value.url);
											}}
										>
											{source.value.url}
										</Anchor>
									)}
								</Text>
							</Stack>
						}
					>
						<Pill size="xs" style={{ ...PILL_BASE }}>
							{source?.type === "memory" && "🧠"}
							{source?.type === "action" && "⚡"}
							{source?.type === "web" && "🔗"}
							{source?.type === "file" && "📎"}
							{!source && "⛓️‍💥"}
						</Pill>
					</Tooltip>
				);
			})}
		</span>
	);
};

export const BlockquoteComponent: Components["blockquote"] = ({
	node,
	children,
}) => {
	return (
		<Quote model={node?.properties.model as string | undefined}>
			{children}
		</Quote>
	);
};

export const AComponent: Components["a"] = ({ href, children }) => {
	return (
		<a
			href={href}
			onClick={(e) => {
				if (!href) return;
				e.preventDefault();
				void TauriUtils.open(href);
			}}
		>
			{children}
		</a>
	);
};

export const LinkComponent: Components["link"] = ({ node }) => {
	const source = ((node?.properties.source ?? "unknown") as string).trim();
	return <Attachment source={source as string} />;
};

export const SlotComponent: Components["slot"] = ({ node, children }) => {
	return (
		<Command
			name={((node?.properties.name ?? "unknown") as string).replace(
				"user-content-",
				"",
			)}
			content={children}
		/>
	);
};
