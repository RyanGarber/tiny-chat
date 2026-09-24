import { resolve } from "node:path";
import FastifyStatic from "@fastify/static";
import { config } from "dotenv";
import Fastify from "fastify";
import { create } from "../../../scripts/use-stdout.ts";

config({ path: "../../.env", quiet: true });

const fastify = Fastify();

fastify.register(FastifyStatic, {
	root: resolve(import.meta.dirname, "../dist"),
});

const update = create("starting web");

export const server = {
	fastify,

	start: () => {
		fastify.listen(
			{ port: parseInt(process.env.VITE_WEB_PORT as string, 10) },
			(err, address) => {
				if (err) {
					fastify.log.error(err);
					process.exit(1);
				}
				update(`web live at: ${address}`);
			},
		);
	},
};
