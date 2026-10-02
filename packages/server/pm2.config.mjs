export const apps = [
	{
		name: "server",
		script: "node",
		args: "./src/server.ts",
		exec_mode: "fork",
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: "512M",
	},
];
