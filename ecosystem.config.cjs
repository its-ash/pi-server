module.exports = {
  apps: [
    {
      name: 'pi-server-backend',
      cwd: '/Users/ashvinijangid/Desktop/pi-server/backend',
      script: 'cargo',
      args: 'run --release',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        RUST_LOG: 'info',
        UPLOAD_DIR: '/Users/ashvinijangid/Desktop/pi-server/files',
        FTP_DIR: '/Users/ashvinijangid/Desktop/pi-server/ftp'
      }
    }
  ]
};
