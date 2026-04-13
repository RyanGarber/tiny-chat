import type { zGenerateOutput } from '../types.ts';
import type { IncomingMessage, ServerResponse } from 'http';
import { auth, toHeaders } from '../server.ts';

export function setupSSE(res: ServerResponse) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.socket?.setNoDelay(true);
  res.flushHeaders();
}

export function sendEvent(res: ServerResponse, event: zGenerateOutput) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function authenticateRequest(req: IncomingMessage, res: ServerResponse) {
  const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
  if (!session?.user) {
    res.writeHead(401);
    res.end('Unauthorized');
    return null;
  }
  return session.user;
}
