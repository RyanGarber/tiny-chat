import {createHTTPHandler} from "@trpc/server/adapters/standalone";
import {PrismaPg} from "@prisma/adapter-pg";
import {createServer, IncomingMessage, ServerResponse} from "http";
import {router} from "./index.ts";
import {betterAuth} from "better-auth";
import {toNodeHandler} from "better-auth/node";
import {anonymous, bearer} from "better-auth/plugins";
import {prismaAdapter} from "better-auth/adapters/prisma";
import {PrismaClient} from "./generated/prisma/client.ts";
import {internalIpV4} from "internal-ip";
import {TRPCError} from "@trpc/server";
import {config} from "dotenv";
import {resolve} from "path";
import {fileURLToPath} from "url";
import folders from "./routes/folders.ts";
import chats from "./routes/chats.ts";
import memories from "./routes/memories.ts";
import messages from "./routes/messages.ts";
import sessions from "./routes/sessions.ts";

config({path: resolve(fileURLToPath(import.meta.url), "../../../.env")});

export const prisma = new PrismaClient({
    adapter: new PrismaPg({
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE
    })
});

const trpc = router({
    folders,
    chats,
    memories,
    messages,
    sessions,
});
export type tRPC = typeof trpc;

const trpcContext = async ({
                               req,
                               res,
                           }: {
    req: IncomingMessage;
    res: ServerResponse;
}) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
        } else if (value) {
            headers.append(key, value);
        }
    }
    const session = await auth.api.getSession({headers});
    if (!session?.user) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Not authenticated. Headers: ${JSON.stringify(Object.fromEntries(headers.entries()))}`,
        });
    }
    return {req, res, session, prisma};
};
export type tRPCContext = Awaited<ReturnType<typeof trpcContext>>;

const trpcHandler = createHTTPHandler({
    router: trpc,
    basePath: `${process.env.VITE_DATA_PATH_TRPC}/`,
    createContext: trpcContext,
    maxBodySize: 50 * 1024 * 1024
});

export const auth = betterAuth({
    baseURL: process.argv.includes('--dev')
        ? `http://${process.argv.includes('--host') ? await internalIpV4() : 'localhost'}:${process.env.VITE_DATA_PORT}`
        : process.env.VITE_DATA_URL,
    basePath: process.env.VITE_DATA_PATH_AUTH,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    user: {
        deleteUser: {
            enabled: true
        },
        additionalFields: {
            settings: {
                type: "json",
                required: true,
                defaultValue: {},
            },
        },
    },
    trustedOrigins: [
        `http://localhost:${process.env.VITE_WEB_PORT}`,
        `http://${await internalIpV4()}:${process.env.VITE_WEB_PORT}`,
        "https://tauri.localhost",
        "tauri://localhost",
        process.env.VITE_WEB_URL!,
    ],
    socialProviders: {
        github: {
            clientId: process.env.AUTH_GITHUB_CLIENT!,
            clientSecret: process.env.AUTH_GITHUB_SECRET
        },
        google: {
            clientId: process.env.AUTH_GOOGLE_CLIENT!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET
        }
    },
    plugins: [anonymous({
        onLinkAccount: async ({anonymousUser, newUser}) => {
            console.log(`Transferring data from anonymous user ${anonymousUser.user.id} to new user ${newUser.user.id}`)
            await prisma.user.update({
                where: {id: newUser.user.id},
                data: {settings: {...anonymousUser.user.settings, ...newUser.user.settings}}
            });
            await prisma.folder.updateMany({where: {userId: anonymousUser.user.id}, data: {userId: newUser.user.id}});
            await prisma.chat.updateMany({where: {userId: anonymousUser.user.id}, data: {userId: newUser.user.id}});
            await prisma.message.updateMany({where: {userId: anonymousUser.user.id}, data: {userId: newUser.user.id}});
            console.log("Transferred:", await prisma.user.findFirst({where: {id: newUser.user.id}}));
        }
    }), bearer()],
});

const authHandler = toNodeHandler(auth);

const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || process.env.VITE_DATA_URL!);
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url?.startsWith(process.env.VITE_DATA_PATH_TRPC!)) {
        trpcHandler(req, res);
    } else if (req.url?.startsWith(process.env.VITE_DATA_PATH_AUTH!)) {
        void authHandler(req, res);
    } else {
        res.writeHead(200);
        res.end("OK");
    }
});

if (import.meta.main) {
    console.log(
        `Backend listening at ${await internalIpV4()}:${process.env.VITE_DATA_PORT}`,
    );
    server.listen(process.env.VITE_DATA_PORT);
}
