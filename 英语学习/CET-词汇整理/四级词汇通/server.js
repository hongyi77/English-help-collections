/* 英语词汇通 - 本地静态服务器(零依赖,node 内置 http)
 * 双击 启动服务器.bat 即可,手机连同一 WiFi 访问显示出的地址
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
  catch { urlPath = '/'; }
  if (urlPath === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('==================================================');
    console.log('  Port ' + PORT + ' is already in use.');
    console.log('  The server may already be running.');
    console.log('  Open http://localhost:' + PORT + ' in your browser.');
    console.log('  Or close the old window and run this again.');
    console.log('==================================================');
  } else {
    console.error('Server error:', err.message);
  }
});

server.listen(PORT, () => {
  const ip = getLanIP();
  console.log('==================================================');
  console.log('  CET-4 Vocabulary App is running');
  console.log('  PC:    http://localhost:' + PORT);
  console.log('  Phone: http://' + ip + ':' + PORT + '   (same WiFi)');
  console.log('  Close: close this window or press Ctrl+C');
  console.log('==================================================');
});
