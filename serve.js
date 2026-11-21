// Servidor estático mínimo para rodar a Marginália localmente ou no hub, sem dependências.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

// Converte a URL em um arquivo dentro de root, ou null se o caminho não for permitido.
function resolvePath(root, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const segments = pathname.split(/[\\/]+/).filter(Boolean);
  // Bloqueia "..", arquivos ocultos e pastas internas como .git e .devhub.
  if (segments.some((s) => s.startsWith('.'))) return null;
  const file = path.resolve(root, ...segments);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

function createServer(root = __dirname) {
  const base = path.resolve(root);
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, 405, 'Método não permitido');
    }
    let file = resolvePath(base, req.url);
    if (!file) return send(res, 403, 'Acesso negado');
    try {
      let info = await fs.promises.stat(file);
      if (info.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await fs.promises.stat(file);
      }
      if (!info.isFile()) return send(res, 404, 'Não encontrado');
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return send(res, 404, 'Não encontrado');
      send(res, 500, 'Erro ao ler o arquivo');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => {
    process.stdout.write(`Marginália em http://localhost:${port}\n`);
  });
}

module.exports = { createServer, resolvePath };
