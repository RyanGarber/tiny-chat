import { or } from "@prisma/orm-postgres/orm-client";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { SettingsUtils } from "@tiny-chat/core/core/utils/SettingsUtils.ts";
import type {
	ChatLike,
	ChatState,
	ProjectLike,
	ProjectState,
} from "@tiny-chat/core/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/features/data/types/user.ts";
import { selectAll } from "../../../db.ts";
import { ChatUtils } from "../utils/ChatUtils.ts";

export const ChatService = {
	/**
	 * Get a chat by itself or any of its messages.
	 */
	getChat: async ({
		user,
		chat: chatLike,
	}: {
		user: zUser;
		chat: ChatLike;
	}): Promise<ChatState> => {
		if (typeof chatLike === "string") chatLike = { id: chatLike };

		const chat = await globalThis.db.orm.public.Chat.where({
			userId: user.id,
		})
			.where((chat) =>
				or(
					chat.id.eq(chatLike.id),
					chat.messages.some((message) => message.id.eq(chatLike.id)),
				),
			)
			.include("messages", (message) => message.select("createdAt"))
			.include("project", (project) => project.select("title", "settings"))
			.first();

		if (!chat) throw new Error(`no chat or message with id ${chatLike.id}`);

		return ChatUtils.toChatState(chat);
	},

	getChats: async ({
		user,
		limit,
		cursor,
	}: {
		user: zUser;
		limit?: number;
		cursor?: string;
	}): Promise<{
		projects: ProjectState[];
		chats: ChatState[];
		nextCursor: string | null;
	}> => {
		const [projectRows, chatRows] = await Promise.all([
			cursor
				? []
				: db.orm.public.Project.where({ userId: user.id })
						.include("chats", (chat) =>
							selectAll(chat, "public", "Chat")
								.where({ temporary: false })
								.include("messages", (message) => message.select("createdAt"))
								.include("project", (project) =>
									project.select("title", "settings"),
								),
						)
						.orderBy((f) => f.createdAt.desc())
						.all(),
			db.orm.public.Chat.where({
				userId: user.id,
				projectId: null,
				temporary: false,
			})
				.include("messages", (message) => message.select("createdAt"))
				.include("project", (project) => project.select("title", "settings"))
				.all(),
		]);

		const timestamp = (chat: ChatState) => {
			return Math.max(
				chat.createdAt.toZonedDateTime("UTC").epochMilliseconds,
				...chat.messages.map(
					(message) =>
						message.createdAt.toZonedDateTime("UTC").epochMilliseconds,
				),
			);
		};

		const sortChats = (chats: ChatState[]) => {
			return chats.sort(
				(a, b) => timestamp(b) - timestamp(a) || a.id.localeCompare(b.id),
			);
		};

		const projects = projectRows.map((project) => ({
			...project,
			chats: sortChats(project.chats.map(ChatUtils.toChatState)),
		}));
		const chats = sortChats(chatRows.map(ChatUtils.toChatState));

		const start = cursor
			? Math.max(
					0,
					chats.findIndex((chat) => chat.id === cursor),
				)
			: 0;
		const end = limit ? start + limit : chats.length;

		return {
			projects,
			chats: chats.slice(start, end),
			nextCursor: chats[end]?.id ?? null,
		};
	},

	/**
	 * Set the title of a chat.
	 */
	setChatTitle: async ({
		user,
		chat,
		title,
	}: {
		user: zUser;
		chat: ChatLike;
		title: string;
	}) => {
		const { id } = await ChatService.getChat({
			user,
			chat,
		});
		await globalThis.db.orm.public.Chat.where({ id }).update({ title });
	},

	setChatProject: async ({
		user,
		chat,
		projectId,
	}: {
		user: zUser;
		chat: ChatLike;
		projectId: string | null;
	}) => {
		const { id } = await ChatService.getChat({ user, chat });
		if (projectId) {
			const project = await globalThis.db.orm.public.Project.where({
				id: projectId,
				userId: user.id,
			})
				.select("id")
				.first();
			if (!project) throw new Error(`no project with id ${projectId}`);
		}
		await globalThis.db.orm.public.Chat.where({ id }).update({ projectId });
	},

	/**
	 * Delete a chat, preserving its project.
	 */
	deleteChat: async ({ user, chat }: { user: zUser; chat: ChatLike }) => {
		if (typeof chat === "string") chat = { id: chat };
		const id = chat.id;
		await globalThis.db.transaction(async (tx) => {
			const existing = await tx.orm.public.Chat.where({ userId: user.id, id })
				.select("id")
				.first();
			if (!existing) return;
			const messages = await tx.orm.public.Message.where({
				chatId: id,
				userId: user.id,
			})
				.select("id")
				.all();
			if (messages.length) {
				// TODO - confirm relations delete and remove this
				await tx.orm.public.MessageContext.where((link) =>
					link.messageId.in(messages.map((message) => message.id)),
				).deleteAll();
				await tx.orm.public.DreamMessage.where((link) =>
					link.messageId.in(messages.map((message) => message.id)),
				).deleteAll();
			}
			await tx.orm.public.Chat.where({ userId: user.id, id }).delete();
		});
	},

	createProject: async ({ user, title }: { user: zUser; title?: string }) => {
		return globalThis.db.orm.public.Project.create({
			id: CommonUtils.getRandomId(),
			userId: user.id,
			title,
		});
	},

	getWorkingDirectory: async ({
		user,
		chat,
		project,
	}: {
		user: zUser;
		chat?: string | null;
		project?: string | null;
	}) => {
		const selected = chat ? await ChatService.getChat({ user, chat }) : null;
		const id = selected ? selected.projectId : project;
		const row = id
			? await globalThis.db.orm.public.Project.where({
					id,
					userId: user.id,
				}).first()
			: null;
		const { folders } = SettingsUtils.of(user, row);
		return { id: row?.id ?? null, cwd: folders[0]?.path ?? null, folders };
	},

	updateProject: async ({
		user,
		project,
		title,
	}: {
		user: zUser;
		project: ProjectLike;
		title: string;
	}) => {
		if (typeof project === "string") project = { id: project };
		await globalThis.db.orm.public.Project.where({
			userId: user.id,
			id: project.id,
		}).update({ title });
	},

	deleteProject: async ({
		user,
		project,
		deleteChats,
	}: {
		user: zUser;
		project: ProjectLike;
		deleteChats: boolean;
	}) => {
		if (typeof project === "string") project = { id: project };
		if (deleteChats) {
			await globalThis.db.orm.public.Chat.where({
				userId: user.id,
				projectId: project.id,
			}).deleteAll();
		}
		await globalThis.db.orm.public.Project.where({
			userId: user.id,
			id: project.id,
		}).delete();
	},
} as const;
