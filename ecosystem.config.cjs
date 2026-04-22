module.exports = {
  apps: [
    {
      name: 'pi-server-backend',
      cwd: '/home/pi-server/backend',
      script: 'cargo',
      args: 'run --release',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        RUST_LOG: 'info',
        UPLOAD_DIR: '/home/pi-server/files',
        FTP_DIR: '/home/pi-server/ftp'
      }
    }
  ]
};
