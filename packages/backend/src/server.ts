import { createServer } from 'http';
import { internalIpV4 } from 'internal-ip';
import { config } from 'dotenv';
import { resolve } from 'path';
import uploadHandler from './services/upload.ts';
import { initLogs } from '@tiny-chat/shared/src/logs.ts';
import { authHandler } from './services/auth.ts';
import { apiHandler } from './services/api.ts';
import { geminiHandler } from './services/gemini.ts';
import onTick from './services/worker.ts';
import { mcpHandler } from './services/mcp.ts';

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });
if (import.meta.main) initLogs(undefined, true);

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? process.env.VITE_BACKEND_URL!);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, tRPC-Accept, X-Upload-Type, X-MCP-URL, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name',
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith(process.env.VITE_BACKEND_PATH_TRPC!)) {
    apiHandler(req, res);
  } else if (req.url?.startsWith(process.env.VITE_BACKEND_PATH_AUTH!)) {
    void authHandler(req, res);
  } else if (req.url?.startsWith('/@/gemini')) {
    void geminiHandler(req, res);
  } else if (req.url?.startsWith('/@/upload')) {
    void uploadHandler(req, res);
  } else if (req.url?.startsWith('/@/mcp')) {
    void mcpHandler(req, res);
  } else {
    res.writeHead(200);
    res.end(`${req.method} ${req.url} OK`);
  }
});

if (import.meta.main) {
  const ipv4 = await internalIpV4();
  server.listen(process.env.VITE_BACKEND_PORT, () => {
    console.log(`Backend listening at ${ipv4}:${process.env.VITE_BACKEND_PORT}`);
    const tick = async () => {
      await onTick();
      setTimeout(() => void tick(), 5 * 1000);
    };
    void tick();
    console.log('Actions worker running');
  });
}
