const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const authHandler = require('./api/auth');
const keysHandler = require('./api/keys');
const validateHandler = require('./api/validate');
const resellerHandler = require('./api/reseller');
const announcementHandler = require('./api/announcement');
const heartbeatHandler = require('./api/heartbeat');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function enhanceResponse(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
}

const server = http.createServer((req, res) => {
  enhanceResponse(res);
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk; });
  req.on('end', () => {
    try {
      req.body = bodyData ? JSON.parse(bodyData) : {};
    } catch (e) {
      req.body = {};
    }
    req.query = parsedUrl.query;

    // Route to API Handlers
    if (pathname === '/api/auth') {
      return authHandler(req, res);
    }
    if (pathname === '/api/keys') {
      return keysHandler(req, res);
    }
    if (pathname === '/api/validate') {
      return validateHandler(req, res);
    }
    if (pathname === '/api/reseller') {
      return resellerHandler(req, res);
    }
    if (pathname === '/api/announcement') {
      return announcementHandler(req, res);
    }
    if (pathname === '/api/heartbeat') {
      return heartbeatHandler(req, res);
    }

    // Serve Static Files from /public
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.apk': 'application/vnd.android.package-archive'
      };

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(content);
      });
    });
  });
});

server.listen(PORT, () => {
  console.log(`⚡ Ninja VIP Admin Panel running on http://localhost:${PORT}`);
  console.log(`🔑 Master Admin Key: ${process.env.ADMIN_KEY || 'NINJA-ADMIN-SECRET-2026'}`);
});
