import "./env.ts";

import { createServer } from "node:http";
import { initLogs } from "@tiny-chat/shared/src/logs.ts";
import { internalIpV4 } from "internal-ip";
import { AuthService } from "./core/services/AuthService.ts";
import { tRPCService } from "./core/services/tRPCService.ts";
import { AntigravityService } from "./features/proxy/services/AntigravityService.ts";
import { McpService } from "./features/proxy/services/McpService.ts";
import { WorkerService } from "./features/worker/services/WorkerService.ts";

if (import.meta.main) initLogs(undefined, true);

const server = createServer((req, res) => {
	res.setHeader(
		"Access-Control-Allow-Origin",
		req.headers.origin ?? (process.env.VITE_BACKEND_URL as string),
	);
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Content-Type, Transfer-Encoding, Authorization, X-Requested-With, Accept, tRPC-Accept, X-Antigravity-Account, X-Mcp-Url, Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name",
	);

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url?.startsWith(process.env.VITE_BACKEND_PATH_TRPC as string)) {
		tRPCService.handle(req, res);
	} else if (
		req.url?.startsWith(process.env.VITE_BACKEND_PATH_AUTH as string)
	) {
		void AuthService.handle(req, res);
	} else if (req.url?.startsWith("/@/antigravity")) {
		void AntigravityService.handle(req, res);
	} else if (req.url?.startsWith("/@/mcp")) {
		void McpService.handle(req, res);
	} else {
		res.writeHead(200);
		res.end(`${req.method} ${req.url} OK`);
	}
});

if (import.meta.main) {
	const host = process.argv.some((arg) => /^['"]?--host['"]?$/.test(arg));
	if (host) console.log("starting in host mode...");
	const ipv4 = host ? await internalIpV4() : "localhost";
	server.listen(process.env.VITE_BACKEND_PORT, () => {
		console.log(`backend live: ${ipv4}:${process.env.VITE_BACKEND_PORT}`);
		const work = async () => {
			await WorkerService.next({});
			setTimeout(() => void work(), 5 * 1000);
		};
		void work();
		console.log("backend worker spawned");
	});
}
