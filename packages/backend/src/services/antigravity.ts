import type { IncomingMessage, ServerResponse } from 'http';
import type { Tool } from 'ai';
import { streamText } from 'ai';
import { z } from 'zod';
import {
  type AntigravityAccount,
  createAntigravityProxyProvider,
} from '@ryangarber/ai-sdk-antigravity-proxy';

export async function antigravityHandler(req: IncomingMessage, res: ServerResponse) {
  const account = JSON.parse(req.headers['x-antigravity-account'] as string) as AntigravityAccount;
  const body = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
  const data = JSON.parse(body || 'null');
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());
  try {
    await generate(data, account, res, abortController.signal);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('[request aborted]');
      return;
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: JSON.stringify(error) })}\n\n`);
  } finally {
    res.end();
  }
}

async function generate(
  data: any,
  account: AntigravityAccount,
  res: ServerResponse,
  abortSignal: AbortSignal,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  console.log('[received data]', data);

  const client = createAntigravityProxyProvider({ account });
  const stream = streamText({
    model: client.languageModel(data.model as string),
    prompt: data.prompt,
    tools: Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-return
      data.tools.map((t: any) => [
        t.name,
        {
          description: t.description,
          inputSchema: z.fromJSONSchema(t.inputSchema as never),
        } satisfies Tool,
      ]),
    ),
    providerOptions: data.providerOptions,
    allowSystemInMessages: true,
    abortSignal,
  });

  for await (const event of stream.fullStream) {
    console.log('[sending chunk]', event);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
