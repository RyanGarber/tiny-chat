export const apps = [
	{
		name: "backend",
		script: "bun",
		args: "run ./src/server.ts",
		exec_mode: "fork",
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: "512M",
	},
];
