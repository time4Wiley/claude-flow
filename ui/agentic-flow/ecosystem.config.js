module.exports = {
  apps: [
    {
      name: 'agentic-api',
      script: './server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/agentic_flow'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      shutdown_with_message: true,
      // Auto-restart on file changes in development
      watch_options: {
        followSymlinks: false,
        usePolling: true,
        interval: 1000
      }
    },
    {
      name: 'agentic-websocket',
      script: './server/websocket-server.js',
      instances: 4, // Fixed number for WebSocket sticky sessions
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        WS_PORT: 3002,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
      },
      error_file: './logs/ws-error.log',
      out_file: './logs/ws-out.log',
      log_file: './logs/ws-combined.log',
      time: true,
      max_memory_restart: '500M'
    },
    {
      name: 'agentic-worker',
      script: './workers/job-processor.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        WORKER_CONCURRENCY: 10
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      max_memory_restart: '2G'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['node1.example.com', 'node2.example.com', 'node3.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourrepo/agentic-flow.git',
      path: '/var/www/agentic-flow',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};