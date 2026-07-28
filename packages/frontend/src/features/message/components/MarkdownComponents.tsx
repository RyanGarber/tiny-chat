import { Anchor, Pill, Stack, Text, Tooltip } from "@mantine/core";
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import * as fuzzysort from "fuzzysort";
import { type CSSProperties, useContext } from "react";
import type { Components } from "streamdown";
import { format } from "timeago.js";
import {
	Attachment,
	Command,
	Quote,
} from "#frontend/core/components/Components.tsx";
import { openExternal } from "#frontend/utils/api.ts";
import { MarkdownContext } from "#frontend/utils/data.ts";
import { GLASS_STYLE, SHADOW } from "#frontend/utils/style.ts";
import { zData } from "#shared/features/data/types/message";

const TOOLTIP_PROPS = {
	multiline: true,
	position: "bottom",
	style: { ...GLASS_STYLE, boxShadow: SHADOW },
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
	const { webReferences, memoryReferences, actionReferences } =
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
					let title = web.title;
					if (!title) {
						try {
							title = new URL(web.url).hostname;
						} catch {
							title = web.url;
						}
					}
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
											void openExternal(web.url);
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
									void openExternal(web.url);
								}}
							>
								🔗
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
				void openExternal(href);
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
