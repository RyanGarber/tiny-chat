import type { IncomingMessage, ServerResponse } from 'http';
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import type { Tool } from 'ai';
import { streamText } from 'ai';
import { z } from 'zod';

export async function geminiHandler(req: IncomingMessage, res: ServerResponse) {
  const token = req.headers.authorization?.split(' ')?.[1];
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
    await generate(data, token!, res, abortController.signal);
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
  refreshToken: string,
  res: ServerResponse,
  abortSignal: AbortSignal,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  console.log('[received data]', data);

  const client = createGeminiProvider({ authType: 'oauth-personal', refreshToken });
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
