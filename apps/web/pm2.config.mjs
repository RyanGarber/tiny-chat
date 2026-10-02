export const apps = [
	{
		name: "web",
		script: "node",
		args: "./src/index.ts",
		exec_mode: "fork",
		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: "512M",
	},
];
