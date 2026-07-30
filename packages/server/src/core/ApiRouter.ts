import { action } from "../features/chat/routes/action.ts";
import { chat } from "../features/chat/routes/chat.ts";
import { file } from "../features/chat/routes/file.ts";
import { memory } from "../features/chat/routes/memory.ts";
import { embedding } from "../features/embedding/routes/embedding.ts";
import { message } from "../features/message/routes/message.ts";
import { web } from "../features/proxy/routes/web.ts";
import { test } from "../features/test/routes/test.ts";
import { upload } from "../features/upload/routes/upload.ts";
import { settings } from "../features/user/routes/settings.ts";
import { user } from "../features/user/routes/user.ts";
import { router } from "../index.ts";

export const ApiRouter = router({
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

export type ApiRouter = typeof ApiRouter;
