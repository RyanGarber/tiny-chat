import { resolve } from "node:path";
import FastifyStatic from "@fastify/static";
import { config } from "dotenv";
import Fastify from "fastify";

config({ path: "../../.env", quiet: true });

const fastify = Fastify();

fastify.register(FastifyStatic, {
	root: resolve(import.meta.dirname, "../dist"),
});

fastify.listen(
	{ port: parseInt(process.env.VITE_WEB_PORT as string, 10) },
	(err, address) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
		console.log(`web live at:`, address);
	},
);
