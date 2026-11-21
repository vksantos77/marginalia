const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../serve.js');

let tmp, root, server, port;

// Faz a requisição com o caminho cru, sem o cliente normalizar "..".
function get(rawPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'marginalia-serve-'));
  root = path.join(tmp, 'site');
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(path.join(root, 'icons'));
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>Marginália</h1>');
  fs.writeFileSync(path.join(root, 'manifest.webmanifest'), '{"name":"Marginália"}');
  fs.writeFileSync(path.join(root, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  fs.writeFileSync(path.join(root, '.git', 'config'), 'segredo-do-git');
  fs.writeFileSync(path.join(tmp, 'segredo.txt'), 'segredo-de-fora');
  server = createServer(root);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a raiz devolve o index.html como HTML', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.type, /^text\/html/);
  assert.equal(res.body, '<h1>Marginália</h1>');
});

test('manifest e service worker vêm com o tipo certo', async () => {
  const manifest = await get('/manifest.webmanifest?v=1');
  assert.equal(manifest.status, 200);
  assert.match(manifest.type, /^application\/manifest\+json/);
  const sw = await get('/sw.js');
  assert.equal(sw.status, 200);
  assert.match(sw.type, /^text\/javascript/);
});

test('HEAD responde sem corpo', async () => {
  const res = await get('/index.html', 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.body, '');
});

test('arquivo inexistente dá 404 sem expor caminho', async () => {
  const res = await get('/nao-existe.html');
  assert.equal(res.status, 404);
  assert.ok(!res.body.includes(root));
});

test('pasta sem index.html dá 404', async () => {
  const res = await get('/icons/');
  assert.equal(res.status, 404);
});

test('não deixa sair da pasta com ..', async () => {
  for (const p of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/icons/..%2f..%2fsegredo.txt', '/..\\segredo.txt']) {
    const res = await get(p);
    assert.notEqual(res.status, 200, p);
    assert.ok(!res.body.includes('segredo-de-fora'), p);
  }
});

test('bloqueia arquivos ocultos como .git', async () => {
  const res = await get('/.git/config');
  assert.equal(res.status, 403);
  assert.ok(!res.body.includes('segredo-do-git'));
});

test('URL mal codificada é recusada', async () => {
  const res = await get('/%E0%A4%A');
  assert.equal(res.status, 403);
});

test('só aceita GET e HEAD', async () => {
  const res = await get('/', 'POST');
  assert.equal(res.status, 405);
});
