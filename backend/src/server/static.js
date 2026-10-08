/**
 * Static Asset Delivery & Modular HTML View Assembler
 */
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('./config');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Assembles HTML with optional <!-- @include path/to/file.html --> tags
 */
function assembleHtml(content) {
  const resolvedPublicDir = path.resolve(PUBLIC_DIR);
  return content.replace(/<!--\s*@include\s+([a-zA-Z0-9_\-\.\/]+)\s*-->/g, (match, partialPath) => {
    const fullPartialPath = path.resolve(PUBLIC_DIR, partialPath);
    if (fullPartialPath.startsWith(resolvedPublicDir) && fs.existsSync(fullPartialPath)) {
      try {
        return fs.readFileSync(fullPartialPath, 'utf8');
      } catch (err) {
        console.warn(`[Static Assembler] Failed to read include ${partialPath}:`, err.message);
      }
    }
    return `<!-- Missing include: ${partialPath} -->`;
  });
}

function serveStaticFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
  const resolvedPath = path.resolve(filePath);
  const resolvedPublicDir = path.resolve(PUBLIC_DIR);

  if (!resolvedPath.startsWith(resolvedPublicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    let content = fs.readFileSync(filePath);
    
    // For HTML files, support dynamic server-side modular component inclusion
    if (ext === '.html') {
      const assembled = assembleHtml(content.toString('utf8'));
      content = Buffer.from(assembled, 'utf8');
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': (ext === '.html' || ext === '.css' || ext === '.js') ? 'no-cache, must-revalidate' : 'public, max-age=3600'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Internal Server Error: ${err.message}`);
  }
}

module.exports = {
  MIME_TYPES,
  assembleHtml,
  serveStaticFile
};
