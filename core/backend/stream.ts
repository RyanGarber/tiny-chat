import {IncomingMessage, ServerResponse} from "http";
import {auth, toHeaders} from "./server.ts";
import {type MessageUnomitted, zGenerateInput} from "./types.ts";
import {services} from "./services/index.ts";
import {PrismaClient} from "./generated/prisma/client.ts";

export default async function streamHandler(req: IncomingMessage, res: ServerResponse, prisma: PrismaClient) {
    try {
        const session = await auth.api.getSession({headers: toHeaders(req.headers)});
        if (!session?.user) {
            res.writeHead(401);
            res.end("Unauthorized");
            return;
        }

        const body = await new Promise<string>((resolve, reject) => {
            let data = '';
            req.on('data', (chunk) => data += chunk);
            req.on('end', () => resolve(data));
            req.on('error', reject);
        })
        console.log("Received body:", body);

        const data = JSON.parse(body);

        const controller = new AbortController();
        res.on('close', () => controller.abort());

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        if (req.url?.startsWith("/@/stream/generate")) {
            const input = zGenerateInput.parse(data);

            const service = services.find(s => s.name === input.config.service);
            if (!service) return;

            const settings = session.user.settings?.services?.[service.name] ?? {};

            const context: MessageUnomitted[] = [];
            const messageDatas = await prisma.message.findMany({
                where: {
                    id: {
                        in: input.context.flatMap(m => m.id ? [m.id] : [])
                    }
                }
            });

            for (const message of input.context) {
                if (message.id) {
                    context.push(messageDatas.find(m => m.id === message.id) as MessageUnomitted);
                } else {
                    context.push(message as MessageUnomitted);
                }
            }

            console.log("Calling model for user with context length:", context.length);

            const stream = service.generate(
                settings,
                input.instruction,
                context,
                input.config,
                controller.signal
            );

            for await (const event of stream) {
                console.log("Sending event:", event);
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }

            res.end();
        }
    } catch (e: any) {
        console.trace("Error while streaming:", e);

        res.writeHead(500);
        res.write(`Error while streaming: ${e.stack ?? e.message ?? e.toString()}`);
    }
}