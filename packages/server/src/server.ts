import "./env.ts";

import { createServer } from "node:http";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { createLogger } from "@tiny-chat/core/src/logger.ts";
import { internalIpV4 } from "internal-ip";
import { create, print } from "../../../scripts/use-stdout.ts";
import { ApiService } from "./core/services/ApiService.ts";
import { AuthService } from "./core/services/AuthService.ts";
import { ActionRunnerService } from "./features/agent/services/ActionRunnerService.ts";
import { DreamRunnerService } from "./features/agent/services/DreamRunnerService.ts";
import { EmbeddingRunnerService } from "./features/embedding/services/EmbeddingRunnerService.ts";
import { AntigravityService } from "./features/proxy/services/AntigravityService.ts";
import { McpService } from "./features/proxy/services/McpService.ts";

if (import.meta.main) {
	createLogger({ logToDisk: true });

	const update = create("starting server");

	const server = createServer((req, res) => {
		res.setHeader(
			"Access-Control-Allow-Origin",
			req.headers.origin ?? (process.env.VITE_SERVER_URL as string),
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

		if (req.url?.startsWith(CommonUtils.endpoints.api as string)) {
			ApiService.handle(req, res);
		} else if (req.url?.startsWith(CommonUtils.endpoints.auth as string)) {
			void AuthService.handle(req, res);
		} else if (req.url?.startsWith(CommonUtils.endpoints.mcp as string)) {
			void McpService.handle(req, res);
		} else if (req.url?.startsWith(CommonUtils.endpoints.antigravity)) {
			void AntigravityService.handle(req, res);
		} else {
			res.writeHead(200);
			res.end(`${req.method} ${req.url} OK`);
		}
	});

	const host = process.argv.some((arg) => /^['"]?--host['"]?$/.test(arg));
	const ipv4 = host ? await internalIpV4() : "localhost";
	server.listen(process.env.VITE_SERVER_PORT, () => {
		update(
			`server live at ${ipv4}:${process.env.VITE_SERVER_PORT}${host ? " (host mode)" : ""}`,
		);
		if (process.argv.some((arg) => /^['"]?--smoke['"]?$/.test(arg))) {
			print({
				message: "server was started in smoke mode. now stopping.",
				level: "warning",
			});
			process.exit(0);
			return;
		}
		const work = async () => {
			await ActionRunnerService.next();
			await DreamRunnerService.next();
			await EmbeddingRunnerService.next();
			setTimeout(() => void work(), 5 * 1000);
		};
		void work();
	});
}
