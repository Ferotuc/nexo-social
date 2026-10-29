import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { mkdtemp, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
config({ path: '.env', quiet: true });
const name = `nexo_verify_${Date.now()}`;
assert.match(name, /^nexo_verify_\d+$/);
const source = resolve('apps/api/drizzle');
const temp = await mkdtemp(join(tmpdir(), 'nexo-migration-'));
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
let pool;
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
  await migrate(drizzle(pool), { migrationsFolder: source });
  assert.equal((await pool.query('SELECT body FROM posts WHERE id=$1', [post.id])).rows.length, 1);
  assert.equal(
    (await pool.query(`SELECT to_regclass('public.notifications') AS name`)).rows[0].name,
    'notifications',
  );
  console.log(
    'OK: segunda migración aplicada; registro anterior conservado y tabla notifications disponible.',
  );
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
} finally {
  if (pool) await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
  await rm(temp, { recursive: true, force: true });
}
