import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { mkdtemp, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
config({ path: '.env', quiet: true });
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname),
  'La verificación utiliza solamente PostgreSQL local.',
);
const name = `nexo_verify_${Date.now()}`;
assert.match(name, /^nexo_verify_\d+$/);
const source = resolve('apps/api/drizzle');
const temp = await mkdtemp(join(tmpdir(), 'nexo-migration-'));
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
let pool;
const evidence = { checkedAt: new Date().toISOString(), steps: [] };
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/' + name;
  pool = new Pool({ connectionString: url.toString() });
  const journal = JSON.parse(await readFile(join(source, 'meta/_journal.json'), 'utf8'));
  await mkdir(join(temp, 'meta'));
  await writeFile(
    join(temp, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
  );
  await copyFile(
    join(source, journal.entries[0].tag + '.sql'),
    join(temp, journal.entries[0].tag + '.sql'),
  );
  await migrate(drizzle(pool), { migrationsFolder: temp });
  const {
    rows: [user],
  } = await pool.query(
    `INSERT INTO users(username,email,password_hash,display_name) VALUES('migration_check','migration@example.invalid','not-a-login-hash','Registro anterior') RETURNING id`,
  );
  const {
    rows: [post],
  } = await pool.query(
    `INSERT INTO posts(author_id,body) VALUES($1,'Este dato debe sobrevivir a la segunda migración') RETURNING id`,
    [user.id],
  );
  console.log('OK: migración inicial aplicada en base vacía; registro de control insertado.');
  evidence.steps.push({
    stage: 'initial',
    migrations: 1,
    postId: post.id,
    body: 'Este dato debe sobrevivir a la segunda migración',
  });
  await writeFile(
    join(temp, 'meta/_journal.json'),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) }),
  );
  await copyFile(
    join(source, journal.entries[1].tag + '.sql'),
    join(temp, journal.entries[1].tag + '.sql'),
  );
  await migrate(drizzle(pool), { migrationsFolder: temp });
  assert.equal(
    (await pool.query('SELECT body FROM posts WHERE id=$1', [post.id])).rows[0].body,
    'Este dato debe sobrevivir a la segunda migración',
  );
  assert.equal(
    (await pool.query(`SELECT to_regclass('public.notifications') AS name`)).rows[0].name,
    'notifications',
  );
  console.log(
    'OK: segunda migración aplicada; registro anterior conservado y tabla notifications disponible.',
  );
  assert.equal(
    (await pool.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')).rows[0]
      .count,
    2,
  );
  evidence.steps.push({
    stage: 'evolution',
    migrations: 2,
    postId: post.id,
    preserved: true,
    addedTable: 'notifications',
  });
  await migrate(drizzle(pool), { migrationsFolder: source });
  console.log('OK: tercera migración de Nexo aplicada; messages y attachments disponibles.');
  await migrate(drizzle(pool), { migrationsFolder: source });
  console.log('OK: repetición de migraciones sin cambios ni duplicados.');
  const result = await pool.query(
    'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
  );
  assert.equal(result.rows[0].count, journal.entries.length);
  assert.equal(
    (await pool.query(`SELECT to_regclass('public.messages') AS name`)).rows[0].name,
    'messages',
  );
  assert.equal(
    (await pool.query(`SELECT to_regclass('public.attachments') AS name`)).rows[0].name,
    'attachments',
  );
  evidence.steps.push({
    stage: 'current',
    migrations: journal.entries.length,
    preserved: true,
    repeatedWithoutDuplicates: true,
  });
  if (process.argv.includes('--evidence'))
    await writeFile('docs/evidence/s12-migrations.json', JSON.stringify(evidence, null, 2));
} finally {
  if (pool) await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
  await rm(temp, { recursive: true, force: true });
}
