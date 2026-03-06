import {IncomingMessage, ServerResponse} from "http";
import {auth, toHeaders} from "./server.ts";
import {type MessageUnomitted, type zData, zGenerateInput, type zGenerateOutput} from "./types.ts";
import {Author} from "./generated/prisma/enums.ts";
import {services} from "./services/index.ts";
import {PrismaClient} from "./generated/prisma/client.ts";
import {tools} from "./tools/index.ts";

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

            // Agentic loop: keep generating until the model stops calling tools
            while (true) {
                const modelData: zData = [];
                const userData: zData = [];

                console.log("Starting model run for message:", input.context[input.context.length - 1].data);
                const stream = service.generate(
                    session,
                    input.instruction,
                    context,
                    input.config,
                    controller.signal,
                    tools,
                );

                for await (const event of stream) {
                    console.log("Sending event:", event);
                    res.write(`data: ${JSON.stringify(event)}\n\n`);

                    // Accumulate assistant data parts (excluding special events)
                    if (event.type === "data") {
                        modelData.push(event.value);
                    }
                }

                // Find any tool calls in this pass
                const toolCalls = modelData.filter(p => p.type === "toolCall");
                if (!toolCalls.length) break;

                // Execute each tool and collect results
                for (const part of toolCalls) {
                    if (part.type !== "toolCall") continue;

                    const tool = tools.find(t => t.name === part.name);
                    if (!tool) {
                        console.warn(`Called tool '${part.name}' does not exist`)
                        userData.push({
                            type: "toolResult",
                            id: part.id,
                            error: true,
                            value: `Tool "${part.name}" not found`
                        });
                        continue;
                    }

                    try {
                        const validated = tool.schema.parse(part.args);
                        const value = await tool.run(session, validated);
                        userData.push({type: "toolResult", id: part.id, value});
                    } catch (e: any) {
                        console.warn(`Called tool '${part.name}' threw error:`, e);
                        userData.push({
                            type: "toolResult",
                            id: part.id,
                            error: true,
                            value: e.message ?? String(e)
                        });
                    }
                }

                // Emit the tool results to the client so the UI can display them
                for (const part of userData) {
                    const event: zGenerateOutput = {type: "data", value: part};
                    console.log("Sending tool result:", event);
                    res.write(`data: ${JSON.stringify(event)}\n\n`);
                }

                // Append the assistant turn and the tool results as a user turn, then loop
                context.push({author: Author.MODEL, data: modelData} as MessageUnomitted);
                context.push({author: Author.USER, data: userData} as MessageUnomitted);
            }

            res.end();
        }
    } catch (e: any) {
        console.trace("Error while streaming:", e);

        res.writeHead(500);
        res.write(`Error while streaming: ${e.stack ?? e.message ?? e.toString()}`);
    }
}