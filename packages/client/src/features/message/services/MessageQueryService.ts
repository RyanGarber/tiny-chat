import type { InfiniteData } from "@tanstack/react-query";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { Client } from "../../../client.ts";
import { useChatStore } from "../../chat/stores/useChatStore.ts";

type Page = Awaited<
	ReturnType<Client["api"]["message"]["getMessages"]["query"]>
>;
type History = InfiniteData<Page, string | null>;

const flatten = (data: History) =>
	[...data.pages].reverse().flatMap((p) => p.messages);
const optionsOf = (data: History) =>
	Object.assign(
		{},
		...data.pages.map((p) => p.branchOptions),
	) as Page["branchOptions"];
const history = (
	messages: MessageState[],
	branchOptions: Page["branchOptions"],
	nextCursor: string | null,
): History => {
	const pages: Page[] = [];
	for (let end = messages.length; end > 0; end -= 5) {
		const from = Math.max(0, end - 5);
		pages.push({
			messages: messages.slice(from, end),
			branchOptions: Object.fromEntries(
				messages
					.slice(from, end)
					.map((message) => [
						message.id,
						branchOptions[message.id] ?? [message.id],
					]),
			),
			nextCursor:
				from > 0 ? messages[from].id : nextCursor ? messages[0].id : null,
		});
	}
	if (!pages.length) pages.push({ messages: [], branchOptions, nextCursor });
	return {
		pages,
		pageParams: pages.map((_, index) =>
			index === 0 ? null : pages[index - 1].nextCursor,
		),
	};
};

export const MessageQueryService = {
	options: (
		client: Client,
		chat: string | null,
		branches: Record<string, string>,
	) =>
		client.query.message.getMessages.infiniteQueryOptions(
			{ chat, limit: 5, branches },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
				staleTime: Infinity,
				placeholderData: (data, query) => {
					const input = query?.queryKey[1] as
						| { input?: { chat?: string | null } }
						| undefined;
					return input?.input?.chat === chat ? data : undefined;
				},
			},
		),

	/** Install persisted content before changing the selected query key. */
	write: async (client: Client, message: MessageState, select = false) => {
		useChatStore.getState().setLastSeen(message.chatId, Date.now());
		const filters = {
			queryKey: client.query.message.getMessages.infiniteQueryKey({
				chat: message.chatId,
			}),
		};
		// Let existing reads settle before writing, including an in-flight branch
		// switch. Cancelling that switch would strand its placeholder history.
		await Promise.allSettled(
			client.queryClient
				.getQueryCache()
				.findAll(filters)
				.flatMap((query) =>
					query.state.fetchStatus === "fetching" && query.promise
						? [query.promise]
						: [],
				),
		);
		const known = client.queryClient
			.getQueriesData<History>(filters)
			.some(([, data]) =>
				data?.pages.some((page) =>
					page.messages.some((m) => m.id === message.id),
				),
			);
		client.queryClient.setQueriesData<History>(
			filters,
			(data) =>
				data && {
					...data,
					pages: data.pages.map((page) => ({
						...page,
						messages: page.messages.map((m) =>
							m.id === message.id ? message : m,
						),
						branchOptions: Object.fromEntries(
							Object.entries(page.branchOptions).map(([id, siblings]) => {
								const sibling = page.messages.find((m) => m.id === id);
								return [
									id,
									sibling?.previousId === message.previousId &&
									!siblings.includes(message.id)
										? [...siblings, message.id]
										: siblings,
								];
							}),
						),
					})),
				},
		);
		if (select && !known) {
			// Other cached selections may now have a new descendant. Mark them stale
			// without fetching; the selected path is populated below.
			await client.queryClient.invalidateQueries({
				...filters,
				refetchType: "none",
			});
		}
		const state = useChatStore.getState();
		if (!select || state.chatId !== message.chatId) return;
		const current = MessageQueryService.options(
			client,
			state.chatId,
			state.branches,
		);
		const data = client.queryClient.getQueryData(current.queryKey);
		const branches = {
			...state.branches,
			[message.previousId ?? ""]: message.id,
		};
		const target = MessageQueryService.options(client, state.chatId, branches);
		if (data) {
			const messages = flatten(data);
			const existing = messages.findIndex((m) => m.id === message.id);
			const parent = messages.findIndex((m) => m.id === message.previousId);
			const sibling = messages.findIndex(
				(m) => m.previousId === message.previousId,
			);
			if (
				existing >= 0 ||
				parent >= 0 ||
				sibling >= 0 ||
				!message.previousId ||
				!messages.length
			) {
				const prefix =
					existing >= 0
						? messages
						: [
								...messages.slice(
									0,
									parent >= 0 ? parent + 1 : Math.max(0, sibling),
								),
								message,
							];
				const branchOptions = optionsOf(data);
				branchOptions[message.id] = branchOptions[message.id] ??
					(sibling >= 0 ? branchOptions[messages[sibling].id] : undefined) ?? [
						message.id,
					];
				client.queryClient.setQueryData(
					target.queryKey,
					history(prefix, branchOptions, data.pages.at(-1)?.nextCursor ?? null),
				);
			}
		}
		useChatStore.getState().selectBranch(message.previousId, message.id);
	},

	/** Fetch back only as far as the already loaded common ancestor. */
	selectBranch: (
		client: Client,
		parentId: string | null,
		messageId: string,
	) => {
		const state = useChatStore.getState();
		if (!state.chatId) return Promise.resolve();
		const chat = state.chatId;
		const source =
			client.queryClient.getQueryData(
				MessageQueryService.options(client, chat, state.branches).queryKey,
			) ??
			client.queryClient
				.getQueriesData<History>({
					queryKey: client.query.message.getMessages.infiniteQueryKey({ chat }),
				})
				.map(([, data]) => data)
				.filter(
					(data): data is History =>
						!!data && flatten(data).some((m) => m.id === parentId),
				)
				.sort((a, b) => flatten(b).length - flatten(a).length)[0];
		const branches = { ...state.branches, [parentId ?? ""]: messageId };
		const options = MessageQueryService.options(client, chat, branches);
		const messages = source ? flatten(source) : [];
		const parent = messages.findIndex((m) => m.id === parentId);
		const prefix = parent >= 0 ? messages.slice(0, parent + 1) : [];
		const cached = client.queryClient.getQueryData(options.queryKey);
		const needsJoin =
			prefix.length &&
			cached &&
			!flatten(cached).some((m) => m.previousId === parentId);
		const loading = client.queryClient.fetchInfiniteQuery({
			...options,
			pages: 1,
			staleTime: needsJoin ? 0 : Infinity,
			queryFn: async ({ signal }) => {
				let cursor: string | undefined;
				let suffix: MessageState[] = [];
				let branchOptions = source ? optionsOf(source) : {};
				while (true) {
					const page = await client.api.message.getMessages.query(
						{ chat, branches, limit: 5, cursor },
						{ signal },
					);
					branchOptions = { ...branchOptions, ...page.branchOptions };
					suffix = [...page.messages, ...suffix];
					const join = suffix.findIndex((m) => m.previousId === parentId);
					if (join >= 0 && (prefix.length || !parentId)) {
						return {
							messages: [...prefix, ...suffix.slice(join)],
							branchOptions,
							nextCursor: prefix.length
								? (source?.pages.at(-1)?.nextCursor ?? null)
								: null,
						};
					}
					if (!page.nextCursor || !prefix.length)
						return {
							messages: suffix,
							branchOptions,
							nextCursor: page.nextCursor,
						};
					cursor = page.nextCursor;
				}
			},
		});
		useChatStore.getState().selectBranch(parentId, messageId);
		return loading.then((data) => {
			const loaded = flatten(data);
			const join = loaded.findIndex((m) => m.previousId === parentId);
			const extend = join >= 0 && prefix.length > join;
			const merged = extend ? [...prefix, ...loaded.slice(join)] : loaded;
			client.queryClient.setQueryData(
				options.queryKey,
				history(
					merged,
					{ ...(source ? optionsOf(source) : {}), ...optionsOf(data) },
					extend
						? (source?.pages.at(-1)?.nextCursor ?? null)
						: (data.pages.at(-1)?.nextCursor ?? null),
				),
			);
		});
	},
} as const;
