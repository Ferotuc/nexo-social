// Reproduce migration generation and verify the publications CRUD on localhost.
// Only generated demonstration accounts and nexo_verify_* temporary databases are used.
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:4100/api';
const mode = process.argv[2];
await mkdir('.local', { recursive: true });
await mkdir('docs/evidence/s12', { recursive: true });
async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: 'http://localhost:3100',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  return {
    status: response.status,
    data: raw ? JSON.parse(raw) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
if (mode === 'generate') {
  const dir = await mkdtemp(resolve('.local/s12-generation-')),
    schema = await readFile('apps/api/src/db/schema.ts', 'utf8');
  const initial = schema.slice(0, schema.indexOf('export const notifications'));
  const evolved = schema.slice(0, schema.indexOf('export const messages'));
  const schemaPath = join(dir, 'schema.ts'),
    out = join(dir, 'drizzle');
  const cli = resolve('node_modules/drizzle-kit/bin.cjs');
  const stages = [];
  for (const [name, source] of [
    ['melodic_hex', initial],
    ['slippery_leper_queen', evolved],
  ]) {
    await writeFile(schemaPath, source);
    const stdout = execFileSync(
      process.execPath,
      [
        cli,
        'generate',
        '--schema',
        relative(process.cwd(), schemaPath).replaceAll('\\', '/'),
        '--out',
        relative(process.cwd(), out).replaceAll('\\', '/'),
        '--dialect',
        'postgresql',
        '--name',
        name,
      ],
      { encoding: 'utf8' },
    );
    console.log(stdout);
    stages.push({
      name,
      stdout: stdout
        .replaceAll(dir, '<carpeta temporal>')
        .replaceAll(dir.replaceAll('\\', '/'), '<carpeta temporal>'),
    });
  }
  for (const name of ['0000_melodic_hex.sql', '0001_slippery_leper_queen.sql']) {
    const actual = (await readFile('apps/api/drizzle/' + name, 'utf8'))
      .replaceAll('\r\n', '\n')
      .trim();
    const generated = (await readFile(join(out, name), 'utf8')).replaceAll('\r\n', '\n').trim();
    assert.equal(generated, actual, 'El SQL reproducido debe coincidir con el historial de Nexo.');
  }
  const report = {
    checkedAt: new Date().toISOString(),
    command:
      'drizzle-kit generate --schema <esquema TypeScript> --out <carpeta temporal> --dialect postgresql',
    stages,
    sqlMatchesRepository: true,
  };
  await writeFile('docs/evidence/s12/generation.json', JSON.stringify(report, null, 2));
  const migrationLog = execFileSync(process.execPath, ['tests/migrations.mjs', '--evidence'], {
    encoding: 'utf8',
  });
  console.log(migrationLog);
  await writeFile('docs/evidence/s12/migrations.log', migrationLog);
} else if (mode === 'before') {
  const tag = Date.now().toString(36);
  const credentials = {
    username: 's12_' + tag,
    email: 's12_' + tag + '@example.invalid',
    displayName: 'Prueba S12',
    password: randomBytes(24).toString('base64url'),
  };
  const auth = await request('/auth/register', { method: 'POST', body: credentials });
  assert.equal(auth.status, 201);
  await writeFile(
    '.local/s12-account.json',
    JSON.stringify({ credentials, userId: auth.data.id, cookie: auth.cookie }),
  );
  const operations = [];
  async function action(title, method, path, body, expected) {
    const r = await request(path, { method, body, cookie: auth.cookie });
    assert.equal(r.status, expected);
    operations.push({ title, method, path, status: r.status, request: body, response: r.data });
    return r.data;
  }
  const post = await action(
    'Crear publicación',
    'POST',
    '/posts',
    { body: 'Prueba de persistencia S12 antes del reinicio' },
    201,
  );
  await action('Consultar por identificador', 'GET', '/posts/' + post.id, undefined, 200);
  const listing = await action(
    'Listar publicaciones',
    'GET',
    '/posts?username=' + credentials.username,
    undefined,
    200,
  );
  assert.ok(listing.items.some((p) => p.id === post.id));
  const updated = await action(
    'Actualizar publicación',
    'PATCH',
    '/posts/' + post.id,
    { body: 'Publicación actualizada S12 y conservada en PostgreSQL' },
    200,
  );
  assert.equal(updated.id, post.id);
  assert.equal(updated.body, 'Publicación actualizada S12 y conservada en PostgreSQL');
  await action('Rechazar texto vacío', 'PATCH', '/posts/' + post.id, { body: '   ' }, 400);
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    postId: post.id,
    expectedBody: updated.body,
    operations,
  };
  await writeFile('docs/evidence/s12/crud-before.json', JSON.stringify(report, null, 2));
  console.log(
    'OK: crear 201, consultar/listar 200, actualizar 200, validación 400. Publicación preparada para reiniciar la API.',
  );
} else if (mode === 'after') {
  const account = JSON.parse(await readFile('.local/s12-account.json', 'utf8'));
  const before = JSON.parse(await readFile('docs/evidence/s12/crud-before.json', 'utf8'));
  const auth = await request('/auth/login', {
    method: 'POST',
    body: { email: account.credentials.email, password: account.credentials.password },
  });
  assert.equal(auth.status, 200);
  const saved = await request('/posts/' + before.postId, { cookie: auth.cookie });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.id, before.postId);
  assert.equal(saved.data.body, before.expectedBody);
  const removed = await request('/posts/' + before.postId, {
    method: 'DELETE',
    cookie: auth.cookie,
  });
  assert.equal(removed.status, 204);
  const missing = await request('/posts/' + before.postId, { cookie: auth.cookie });
  assert.equal(missing.status, 404);
  await writeFile(
    'docs/evidence/s12/crud-after.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        samePostId: before.postId,
        sameBody: saved.data.body,
        preservedAfterRestart: true,
        operations: [
          {
            title: 'Consultar tras reinicio',
            method: 'GET',
            path: '/posts/' + before.postId,
            status: saved.status,
            response: saved.data,
          },
          {
            title: 'Eliminar publicación propia',
            method: 'DELETE',
            path: '/posts/' + before.postId,
            status: removed.status,
            response: null,
          },
          {
            title: 'Consultar registro eliminado',
            method: 'GET',
            path: '/posts/' + before.postId,
            status: missing.status,
            response: missing.data,
          },
        ],
      },
      null,
      2,
    ),
  );
  await request('/auth/logout', { method: 'POST', cookie: auth.cookie });
  console.log(
    'OK: mismo identificador y texto después del reinicio; DELETE 204 y consulta posterior 404.',
  );
} else throw new Error('Uso: node scripts/s12-evidence.mjs generate|before|after');
