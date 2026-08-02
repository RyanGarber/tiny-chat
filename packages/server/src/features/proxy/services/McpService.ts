import {
	request as httpRequest,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";

/**
 * A thin wrapper around MCP streams, preventing CORS errors.
 */
export const McpService = {
	handle: async (req: IncomingMessage, res: ServerResponse) => {
		try {
			const url = new URL(req.headers["x-mcp-url"] as string);
			delete req.headers["x-mcp-url"];

			const extraPath = req.url?.replace(CommonUtils.endpoints.mcp, "") ?? "";
			url.pathname = url.pathname + extraPath;

			const chunks: Buffer[] = [];
			req.on("data", (c) => chunks.push(c as Buffer));
			req.on("end", () => {
				McpService.forward(
					url,
					req.method ?? "GET",
					req.headers,
					Buffer.concat(chunks),
					res,
				);
			});
			req.on("error", (error) => {
				console.error(error);
				res.writeHead(400);
				res.end("Bad Request");
			});
		} catch (error) {
			console.error(error);
			res.writeHead(500);
			res.end("Internal Server Error");
		}
	},
	forward: async (
		url: URL,
		method: string,
		headers: Record<string, any>,
		body: Buffer,
		res: ServerResponse,
		redirectsLeft = 5,
	) => {
		const request = url.protocol === "https:" ? httpsRequest : httpRequest;

		console.log(
			`proxying http via backend: ${url.hostname}:${url.port}${url.pathname + url.search}`,
		);

		const proxy = request(
			{
				hostname: url.hostname,
				port: url.port || (url.protocol === "https:" ? 443 : 80),
				path: url.pathname + url.search,
				auth: url.username
					? `${url.username}:${decodeURIComponent(url.password)}`
					: undefined,
				headers: { ...headers, host: url.host }, // rewrite host to upstream
				method,
			},
			(proxyRes: IncomingMessage) => {
				const { statusCode, headers: proxyHeaders } = proxyRes;

				// Ensure all mcp headers are available
				const MCP_HEADERS = [
					"mcp-session-id",
					"mcp-protocol-version",
					"mcp-method",
					"mcp-name",
				];
				const exposed = new Set(
					(proxyHeaders["access-control-expose-headers"] ?? "")
						.split(",")
						.map((h) => h.trim().toLowerCase())
						.filter(Boolean),
				);
				for (const h of MCP_HEADERS) exposed.add(h);
				proxyHeaders["access-control-expose-headers"] = [...exposed].join(", ");

				// Fix nginx header conflict
				delete proxyHeaders["content-length"];
				delete proxyHeaders["transfer-encoding"];

				if (
					(statusCode === 301 ||
						statusCode === 302 ||
						statusCode === 307 ||
						statusCode === 308) &&
					proxyHeaders.location &&
					redirectsLeft > 0
				) {
					proxyRes.resume(); // drain so the socket is released
					const next = new URL(proxyHeaders.location, url); // handles relative locations
					// 307/308 must preserve method+body; 301/302 conventionally collapse to GET
					const nextMethod =
						statusCode === 307 || statusCode === 308 ? method : "GET";
					const nextBody = nextMethod === "GET" ? Buffer.alloc(0) : body;
					McpService.forward(
						next,
						nextMethod,
						headers,
						nextBody,
						res,
						redirectsLeft - 1,
					);
					return;
				}

				console.log(`returning http response:`, statusCode, proxyHeaders);

				res.writeHead(statusCode ?? 200, proxyHeaders);
				proxyRes.pipe(res);
			},
		);

		proxy.on("error", (error) => {
			console.error(error);
			if (!res.headersSent) {
				res.writeHead(502);
				res.end("Bad Gateway");
			}
		});

		console.log(
			`sending http request:`,
			method,
			url.pathname + url.search,
			body.length,
			headers,
		);

		if (body.length) proxy.write(body);
		proxy.end();
	},
} as const;
