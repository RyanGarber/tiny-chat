import {IncomingMessage, ServerResponse} from "http";
import {auth, toHeaders} from "./server.ts";
import {type MessageUnomitted, zData, zGenerateInput, type zGenerateOutput} from "./types.ts";
import {chatProviders} from "./providers/chat/index.ts";
import {Author, PrismaClient} from "./generated/prisma/client.ts";
import {tools} from "./tools/index.ts";

export default async function chatHandler(req: IncomingMessage, res: ServerResponse, prisma: PrismaClient) {
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

        const data = JSON.parse(body);

        const controller = new AbortController();
        res.on('close', () => controller.abort());

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const input = zGenerateInput.parse(data);

        const service = chatProviders.find(s => s.name === input.config.service);
        if (!service) return;

        const context: MessageUnomitted[] = [];
        const messageDatas = await prisma.message.findMany({
            where: {
                id: {
                    in: input.context.flatMap(m => m.id ? [m.id] : [])
                }
            }
        });

        // Fix up the context so that tool results are split into separate messages with the correct author
        for (const item of input.context) {
            const messageData = messageDatas.find(m => m.id === item.id);
            if (messageData) {
                context.push(messageData as MessageUnomitted);
            } else {
                context.push(item as MessageUnomitted);
            }
        }

        // Agentic loop: keep generating until the model stops calling tools
        while (true) {
            const message = context[context.length - 1];
            console.log("Starting model run for message:", message);

            const stream = service.generate(
                session,
                input.instruction,
                context,
                input.config,
                controller.signal,
                tools(session),
            );

            const modelMessage = {...message, author: Author.MODEL, data: []} as MessageUnomitted;
            const userMessage = {...message, author: Author.USER, data: []} as MessageUnomitted;

            for await (const event of stream) {
                console.log("Sending event:", event);
                res.write(`data: ${JSON.stringify(event)}\n\n`);

                if (event.type === "data") {
                    modelMessage.data.push(event.value);
                }

                if (event.type === "special" && event.value.type === "metadata") {
                    modelMessage.metadata = event.value.value; // to push Gemini thoughtSignature into next pass
                }
            }

            // Find any tool calls in this pass
            const toolCalls = modelMessage.data.filter(p => p.type === "toolCall");
            if (!toolCalls.length) break;

            // Execute each tool and collect results
            for (const part of toolCalls) {
                if (part.type !== "toolCall") continue;

                const tool = tools(session).find(t => t.name === part.name);
                if (!tool) {
                    console.warn(`Called tool '${part.name}' does not exist`)
                    userMessage.data.push({
                        type: "toolResult",
                        id: part.id,
                        name: part.name,
                        error: true,
                        value: `Tool "${part.name}" not found`
                    });
                    continue;
                }

                try {
                    const validated = tool.schema.parse(part.args);
                    const value = await tool.run(session, validated);
                    userMessage.data.push({type: "toolResult", id: part.id, name: part.name, value});
                } catch (e: any) {
                    console.warn(`Called tool '${part.name}' threw error:`, e);
                    userMessage.data.push({
                        type: "toolResult",
                        id: part.id,
                        name: part.name,
                        error: true,
                        value: e.message ?? String(e)
                    });
                }
            }

            // Emit the tool results to the client so the UI can display them
            for (const part of userMessage.data) {
                const event: zGenerateOutput = {type: "data", value: part};
                console.log("Sending tool result:", event);
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }

            // Append the assistant turn and the tool results as a user turn, then loop
            context.push(modelMessage);
            context.push(userMessage);
        }
    } catch (e: any) {
        console.trace("Error while streaming:", e);
        res.write(`error: ${JSON.stringify({stack: e.stack, message: e.message})}\n\n`);
    } finally {
        res.end();
    }
}

export function splitToolResults(messages: MessageUnomitted[]) {
    const splitMessages: MessageUnomitted[] = [];
    for (let i = 0; i < messages.length; i++) {
        const parts = zData.parse(messages[i].data);
        const message = {...messages[i], data: []} as MessageUnomitted;
        for (const part of parts) {
            if (part.type === "toolResult" && message.data.find(p => p.type !== "toolResult")) {
                splitMessages.push({...message});
                message.data = [];
                message.author = Author.USER;
            }
            if (part.type !== "toolResult" && message.data.find(p => p.type === "toolResult")) {
                splitMessages.push({...message});
                message.data = [];
                message.author = Author.MODEL;
            }
            message.data.push(part);
        }
        if (message.data.length) splitMessages.push(message);
    }
    return splitMessages;
}