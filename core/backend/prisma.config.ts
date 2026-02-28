import {defineConfig} from "prisma/config";
import {config} from "dotenv";

config({path: "../../.env"});

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}?schema=public&connection_limit=5&pool_timeout=0&socket_timeout=0`
    },
});
