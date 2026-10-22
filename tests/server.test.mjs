import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from '../scripts/serve.mjs';

test('本地服务器提供静态文件和 MIME，且不暴露仓库配置', async t => {
  const server = makeServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(`${origin}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /LabForm/);
  const script = await fetch(`${origin}/app.js`, { method: 'HEAD' });
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /text\/javascript/);
  assert.equal(await script.text(), '');
  for (const path of ['/.openai/hosting.json', '/package.json', '/%2e%2e%2f.openai/hosting.json']) {
    const res = await fetch(`${origin}${path}`);
    assert.notEqual(res.status, 200, path);
  }
  const mutation = await fetch(origin, { method: 'POST' });
  assert.equal(mutation.status, 405);
});
