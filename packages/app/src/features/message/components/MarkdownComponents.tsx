import { Anchor, Pill, Stack, Text, Tooltip } from "@mantine/core";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import * as fuzzysort from "fuzzysort";
import { type CSSProperties, useContext } from "react";
import type { Components } from "streamdown";
import { format } from "timeago.js";
import {
	Attachment,
	Command,
	Quote,
} from "#app/core/components/Components.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { MarkdownContext } from "#app/features/message/components/MarkdownContext.tsx";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";
import { zData } from "#core/features/data/types/message";

const TOOLTIP_PROPS = {
	multiline: true,
	position: "bottom",
	style: { ...StyleUtils.glass, boxShadow: StyleUtils.shadow },
	p: "md",
	c: "var(--mantine-color-text)",
} as const;

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
	const { webReferences, memoryReferences, actionReferences, fileReferences } =
		useContext(MarkdownContext);
	const sources = ((node?.properties.sources ?? "") as string)
		.replace("user-content-", "")
		.split(/[\s;,]+/);

	return (
		<span>
			{children}
			{sources.map((id) => {
				const memory = memoryReferences.find((memory) => {
					const score = fuzzysort.single(id, memory.id)?.score;
					return score && score > 0.95;
				});
				if (memory) {
					return (
						<Tooltip
							key={id}
							{...TOOLTIP_PROPS}
							label={
								<Stack gap="xs" maw={300}>
									<Text size="sm" fw={500} lineClamp={2}>
										{memory.fact}
									</Text>
									<Text size="xs" c="dimmed">
										Learned {format(memory.createdAt)}
									</Text>
								</Stack>
							}
						>
							<Pill size="xs" style={{ ...PILL_BASE }}>
								🧠
							</Pill>
						</Tooltip>
					);
				}

				const action = actionReferences.find((action) => {
					const score = fuzzysort.single(id, action.id)?.score;
					return score && score > 0.95;
				});
				if (action) {
					return (
						<Tooltip
							key={id}
							{...TOOLTIP_PROPS}
							label={
								<Stack gap="xs" maw={300}>
									<Text size="sm" fw={500} lineClamp={2}>
										{DataUtils.getTextCleaned({
											data: zData.parse(action.data),
										})}
									</Text>
									<Text size="xs" c="dimmed">
										{action.nextRunAt
											? `Next run ${format(action.nextRunAt)}`
											: "All runs completed"}
									</Text>
								</Stack>
							}
						>
							<Pill size="xs" style={{ ...PILL_BASE }}>
								⚡
							</Pill>
						</Tooltip>
					);
				}

				const web = webReferences.find((webSearchResult) => {
					const score = fuzzysort.single(webSearchResult.url, id)?.score;
					return score && score > 0.9;
				});
				if (web) {
					const title = web.title ?? PathUtils.name({ path: web.url });
					return (
						<Tooltip
							key={id}
							{...TOOLTIP_PROPS}
							label={
								<Stack gap="xs" maw={300}>
									<Text size="sm" fw={500} lineClamp={2}>
										{title}
									</Text>
									<Anchor
										size="xs"
										lineClamp={1}
										href={web.url}
										target="_blank"
										onClick={(e) => {
											e.preventDefault();
											void TauriUtils.open(web.url);
										}}
									>
										{web.url}
									</Anchor>
								</Stack>
							}
						>
							<Pill
								size="xs"
								style={{ ...PILL_BASE, cursor: "pointer" }}
								onClick={(e) => {
									e.preventDefault();
									void TauriUtils.open(web.url);
								}}
							>
								🔗
							</Pill>
						</Tooltip>
					);
				}

				const file = fileReferences.find((file) => {
					const score = fuzzysort.single(file.uri, id)?.score;
					return score && score > 0.9;
				});
				if (file) {
					return (
						<Tooltip
							key={id}
							{...TOOLTIP_PROPS}
							label={
								<Stack gap="xs" maw={300}>
									<Text size="sm" fw={500} lineClamp={2}>
										{PathUtils.name(file.uri)}
									</Text>
									<Text size="xs" c="dimmed">
										{file.uri}
									</Text>
								</Stack>
							}
						>
							<Pill
								size="xs"
								style={{ ...PILL_BASE, cursor: "pointer" }}
								onClick={(e) => {
									e.preventDefault();
									// TODO WIP - open file preview
								}}
							>
								📎
							</Pill>
						</Tooltip>
					);
				}

				return (
					<Tooltip
						key={id}
						{...TOOLTIP_PROPS}
						label={
							<Stack gap="xs" maw={300}>
								<Text size="xs" c="dimmed">
									{id}
								</Text>
							</Stack>
						}
					>
						<Pill size="xs" style={{ ...PILL_BASE }}>
							<Text span c="dimmed">
								﹖
							</Text>
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
