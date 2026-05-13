module.exports = {
  apps: [
    {
      name: 'web',
      script: 'bun',
      args: 'run ./src/index.ts',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
