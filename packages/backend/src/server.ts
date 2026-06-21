import { createServer } from 'http';
import { internalIpV4 } from 'internal-ip';
import { config } from 'dotenv';
import { resolve } from 'path';
import { initLogs } from '@tiny-chat/shared/src/logs.ts';

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const [
  { authHandler },
  { apiHandler },
  { antigravityHandler },
  { mcpHandler },
  { default: onTick },
] = await Promise.all([
  import('./services/auth.ts'),
  import('./services/api.ts'),
  import('./services/antigravity.ts'),
  import('./services/mcp.ts'),
  import('./services/worker.ts'),
]);

if (import.meta.main) initLogs(undefined, true);

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? process.env.VITE_BACKEND_URL!);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Transfer-Encoding, Authorization, X-Requested-With, Accept, tRPC-Accept, X-Antigravity-Account, X-Mcp-Url, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name',
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
  } else if (req.url?.startsWith('/@/antigravity')) {
    void antigravityHandler(req, res);
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
