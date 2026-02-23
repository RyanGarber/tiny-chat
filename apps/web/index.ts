import Fastify from "fastify";
import FastifyStatic from "@fastify/static";
import {fileURLToPath} from "url";
import {resolve} from "path";
import {config} from "dotenv";

config({path: "../../.env"});

const fastify = Fastify();

fastify.register(FastifyStatic, {
    root: resolve(fileURLToPath(import.meta.url), "../dist"),
});

fastify.listen({port: parseInt(process.env.VITE_WEB_PORT)}, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log(`Web listening at ${address}`);
});
