import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Avatar,
	Burger,
	Group,
	NavLink,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
	Spotlight,
	type SpotlightActionData,
	spotlight,
} from "@mantine/spotlight";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import SidebarAccount from "#frontend/core/components/SidebarAccount.tsx";
import SidebarSettings from "#frontend/core/components/SidebarSettings.tsx";
import { useLayoutStore } from "#frontend/core/stores/useLayoutStore.tsx";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { ChatService } from "#frontend/features/chat/services/ChatService.ts";
import { useChatStore } from "#frontend/features/chat/stores/useChatStore.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";
import { useRetrieval } from "#frontend/features/settings/hooks/useRetrieval.ts";
import { auth, env, query } from "#frontend/utils/api.ts";
import { GLASS_STYLE } from "#frontend/utils/theme.ts";
import { embed } from "#shared/services/chat/embed.ts";
import { scrubText, snippetText, texts } from "#shared/utils.ts";
import { version } from "../../../../../apps/tauri/tauri.conf.json";
import SidebarChatList from "./SidebarChatList.tsx";

export default function Sidebar() {
	const { chat } = useChat();
	const createTemporary = useChatStore((s) => s.createTemporary);
	const { embeddingConfig, useEmbeddingSearch } = useRetrieval();

	const setCreateTemporary = useChatStore((s) => s.setCreateTemporary);
	const createIncognito = useChatStore((s) => s.createIncognito);
	const setCreateIncognito = useChatStore((s) => s.setCreateIncognito);
	const isTemporary = chat.data?.temporary ?? createTemporary;
	const isIncognito = chat.data?.incognito ?? createIncognito;

	const isMobile = useLayoutStore((s) => s.isMobile);
	const isSidebarOpen = useLayoutStore((s) => s.isSidebarOpen);
	const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);

	const { data: session } = auth.useSession();

	const closeAfter = useCallback(
		(action?: () => void) => {
			action?.();
			if (isMobile) setSidebarOpen(false);
		},
		[isMobile, setSidebarOpen],
	);

	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery] = useDebouncedValue(searchQuery, 400);
	const embeddingCache = useRef<Map<string, number[]>>(new Map());

	const debouncedSearch = useQuery({
		queryKey: ["search", debouncedQuery],
		queryFn: async () => {
			if (debouncedQuery.trim().length < 3) {
				return null;
			}

			if (!embeddingConfig.data || !useEmbeddingSearch.data) {
				return { text: debouncedQuery, embedding: undefined };
			}

			if (!session) return { text: debouncedQuery, embedding: undefined };
			const provider = (
				await ProviderService.getChatProviders(session.user)
			).find((p) => p.name === embeddingConfig.data?.provider);
			if (!provider) return { text: debouncedQuery, embedding: undefined };

			if (!embeddingCache.current.has(debouncedQuery)) {
				console.log("Generating embedding for search:", debouncedQuery);
				const embedding = await embed(
					session.user,
					provider,
					[debouncedQuery],
					embeddingConfig.data,
					env,
				);
				embeddingCache.current.set(debouncedQuery, embedding[0]);
			}

			return {
				text: debouncedQuery,
				embedding: embeddingCache.current.get(debouncedQuery),
			};
		},
		enabled: debouncedQuery.trim().length >= 3,
	});

	const spotlightActions = useInfiniteQuery({
		...query.chat.search.infiniteQueryOptions(
			{
				text: debouncedSearch?.data?.text,
				embedding: debouncedSearch?.data?.embedding,
				limit: 5,
			},
			{
				enabled: debouncedQuery.trim().length >= 3,
				getNextPageParam: (lastPage) => lastPage.nextCursor,
				select: (data) => {
					return {
						pages: data.pages.map((page) => ({
							...page,
							results: page.results.map(
								(result): SpotlightActionData => ({
									id: result.id,
									label: result.chatTitle
										? scrubText(result.chatTitle, 50)
										: undefined,
									description: snippetText(
										scrubText(texts(result.data)),
										debouncedQuery,
									),
									onClick: () =>
										closeAfter(() => ChatService.setChatId(result.chatId)),
									group: result.chatTitle ?? undefined,
								}),
							),
						})),
						pageParams: data.pageParams,
					};
				},
			},
		),
	});

	const expanded = (
		<>
			<Group justify="space-between" p="xs">
				<ActionIcon variant="transparent" onClick={spotlight.open}>
					<Icon
						icon="lucide:search"
						height={18}
						color="var(--mantine-color-text)"
					/>
				</ActionIcon>
				<Spotlight
					actions={spotlightActions.data?.pages.flatMap((p) => p.results) ?? []}
					query={searchQuery}
					onQueryChange={setSearchQuery}
					highlightQuery
					scrollAreaProps={{
						mah: 400,
						onBottomReached: () => {
							if (spotlightActions.isFetching) return;
							void spotlightActions.fetchNextPage();
						},
					}}
					nothingFound={
						spotlightActions.isFetching
							? "Searching..."
							: searchQuery.trim().length >= 3
								? "No results"
								: "Type to search…"
					}
					filter={(_, actions) => actions}
					styles={{
						content: GLASS_STYLE,
					}}
				/>
				<Burger
					opened={isSidebarOpen}
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					size={16}
				/>
			</Group>
			<Group align="center" my="md" gap={3}>
				<NavLink
					label="New Chat"
					variant="filled"
					c="dimmed"
					className="nav-link-like filled"
					leftSection={<Icon icon="lucide:message-circle-plus" height={18} />}
					onClick={() => closeAfter(() => ChatService.setChatId(null))}
					active={!chat.data}
					flex={1}
					h={40}
				/>
				<Tooltip label="Temporary" color="gray" position="right">
					<ActionIcon
						size={40}
						variant="subtle"
						c={!isTemporary ? "dimmed" : undefined}
						className="nav-link-like"
						onClick={() =>
							closeAfter(() => {
								if (chat.data) ChatService.setChatId(null);
								setCreateTemporary(!isTemporary);
							})
						}
						data-active={isTemporary}
					>
						<Icon icon="lucide:eye-off" height={18} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Anonymous" color="gray" position="right">
					<ActionIcon
						size={40}
						variant="subtle"
						c={!isIncognito ? "dimmed" : undefined}
						className="nav-link-like"
						onClick={() =>
							closeAfter(() => {
								if (chat.data) ChatService.setChatId(null);
								setCreateIncognito(!isIncognito);
							})
						}
						data-active={isIncognito}
					>
						<Icon icon="lucide:ghost" height={18} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<SidebarChatList />
			<SidebarAccount>
				{(openAccount) => (
					<NavLink
						mt="lg"
						c="dimmed"
						label={
							!session?.user || session.user.isAnonymous
								? "Sign In"
								: session.user.name.split(" ")[0]
						}
						leftSection={
							session?.user?.image ? (
								<Avatar src={session.user.image} size={18} />
							) : (
								<Icon icon="lucide:circle-user" height={18} />
							)
						}
						onClick={openAccount}
						h={40}
						mb={5}
					/>
				)}
			</SidebarAccount>
			<SidebarSettings>
				{(openSettings) => (
					<NavLink
						c="dimmed"
						label={
							<Group justify="space-between">
								Settings
								<Text size="sm" c="dimmed" pr={5}>
									{version}
								</Text>
							</Group>
						}
						leftSection={<Icon icon="lucide:settings" height={18} />}
						onClick={openSettings}
						h={40}
						mb={5}
					/>
				)}
			</SidebarSettings>
		</>
	);

	const collapsed = (
		<Stack align="center" justify="space-between" h="100%" py="xs">
			<Stack align="center" gap="lg">
				<Burger
					opened={isSidebarOpen}
					onClick={() => setSidebarOpen(!isSidebarOpen)}
					size={16}
				/>
				<Tooltip label="New Chat" position="right" color="gray">
					<ActionIcon
						size={32}
						variant="subtle"
						c="dimmed"
						className="nav-link-like filled"
						data-active={!chat.data}
						onClick={() => closeAfter(() => ChatService.setChatId(null))}
					>
						<Icon icon="lucide:message-circle-plus" height={18} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Temporary" color="gray" position="right">
					<ActionIcon
						size={32}
						variant="subtle"
						c={!isTemporary ? "dimmed" : undefined}
						className="nav-link-like"
						data-active={isTemporary}
						onClick={() =>
							closeAfter(() => {
								if (chat.data) ChatService.setChatId(null);
								setCreateTemporary(!isTemporary);
							})
						}
					>
						<Icon icon="lucide:eye-off" height={18} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label="Anonymous" color="gray" position="right">
					<ActionIcon
						size={32}
						variant="subtle"
						c={!isIncognito ? "dimmed" : undefined}
						className="nav-link-like"
						data-active={isIncognito}
						onClick={() =>
							closeAfter(() => {
								if (chat.data) ChatService.setChatId(null);
								setCreateIncognito(!isIncognito);
							})
						}
					>
						<Icon icon="lucide:ghost" height={18} />
					</ActionIcon>
				</Tooltip>
			</Stack>
			<Stack align="center" gap="sm">
				<SidebarAccount>
					{(openAccount) => (
						<Tooltip
							label={
								!session?.user || session.user.isAnonymous
									? "Sign In"
									: session.user.name.split(" ")[0]
							}
							position="right"
							color="gray"
						>
							<ActionIcon
								size={32}
								variant="subtle"
								c="dimmed"
								className="nav-link-like"
								onClick={openAccount}
							>
								{session?.user?.image ? (
									<Avatar src={session.user.image} size={18} />
								) : (
									<Icon icon="lucide:user-x" height={18} />
								)}
							</ActionIcon>
						</Tooltip>
					)}
				</SidebarAccount>
				<SidebarSettings>
					{(openSettings) => (
						<Tooltip label="Settings" position="right" color="gray">
							<ActionIcon
								variant="subtle"
								size={32}
								c="dimmed"
								className="nav-link-like"
								onClick={openSettings}
							>
								<Icon icon="lucide:settings" height={18} />
							</ActionIcon>
						</Tooltip>
					)}
				</SidebarSettings>
			</Stack>
		</Stack>
	);

	if (isMobile) {
		return expanded;
	}

	return (
		<div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: isSidebarOpen ? 1 : 0,
					visibility: isSidebarOpen ? "visible" : "hidden",
					transition:
						"opacity 200ms ease 50ms, visibility 0ms linear " +
						(isSidebarOpen ? "0ms" : "250ms"),
					display: "flex",
					flexDirection: "column",
				}}
			>
				{expanded}
			</div>
			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: isSidebarOpen ? 0 : 1,
					visibility: isSidebarOpen ? "hidden" : "visible",
					transition:
						"opacity 200ms ease 50ms, visibility 0ms linear " +
						(isSidebarOpen ? "250ms" : "0ms"),
					display: "flex",
					flexDirection: "column",
				}}
			>
				{collapsed}
			</div>
		</div>
	);
}
