import { action } from "../../features/chat/routes/action.ts";
import { chat } from "../../features/chat/routes/chat.ts";
import { file } from "../../features/chat/routes/file.ts";
import { memory } from "../../features/chat/routes/memory.ts";
import { embedding } from "../../features/embedding/routes/embedding.ts";
import { message } from "../../features/message/routes/message.ts";
import { web } from "../../features/proxy/routes/web.ts";
import { upload } from "../../features/upload/routes/upload.ts";
import { settings } from "../../features/user/routes/settings.ts";
import { user } from "../../features/user/routes/user.ts";
import { router } from "../../index.ts";
import { test } from "./test.ts";

export const tRPCRouter = router({
	user,
	chat,
	file,
	action,
	memory,
	upload,
	settings,
	embedding,
	message,
	web,
	test,
});

export type tRPCRouter = typeof tRPCRouter;
