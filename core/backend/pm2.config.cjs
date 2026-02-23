module.exports = {
    apps: [{
        name: "core-backend",
        script: "npm",
        args: "start",
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "512M",
    }]
}