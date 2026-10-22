import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRoot = resolve(projectRoot, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const inside = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** Serve only the requested static directory, never the repository/configuration. */
export function makeServer(root = defaultRoot) {
  root = resolve(root);
  return createServer(async (req, res) => {
    const reply = (status, text) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : text);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD'); reply(405, 'Method not allowed'); return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch { reply(400, 'Malformed URL'); return; }
    if (pathname.includes('\0') || pathname.includes('\\')) { reply(400, 'Invalid path'); return; }
    let file = resolve(root, `.${pathname}`);
    if (!inside(root, file)) { reply(403, 'Forbidden'); return; }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      const canonicalRoot = await realpath(root);
      file = await realpath(file);
      if (!inside(canonicalRoot, file)) { reply(403, 'Forbidden'); return; }
      const info = await stat(file);
      if (!info.isFile()) { reply(404, 'Not found'); return; }
      res.writeHead(200, {
        'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) { reply(error.code === 'EACCES' ? 403 : 404, 'Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  const port = Number(portArg ? portArg.slice(7) : process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('端口须为 1–65535 的整数，例如 npm start -- --port=8081');
    process.exitCode = 1;
  } else {
    const server = makeServer();
    server.on('error', error => { console.error(`无法启动：${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => {
      console.log(`LabForm 已启动：http://127.0.0.1:${port}/`);
      console.log(`使用指南：http://127.0.0.1:${port}/guide.html`);
      console.log('按 Ctrl+C 停止。');
      if (process.argv.includes('--open') && process.platform === 'win32') {
        const browser = spawn('explorer.exe', [`http://127.0.0.1:${port}/`], { stdio: 'ignore' });
        browser.on('error', () => console.log('请手动打开上方地址。'));
      }
    });
  }
}
