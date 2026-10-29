import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const api = process.env.TEST_API_URL || 'http://127.0.0.1:4100/api';
const filename = 'docs/evidence/persistence.json';
const data = await (await fetch(api + '/posts')).json();
assert.ok(
  data.items.length > 0,
  'Debe existir al menos una publicación antes de comprobar persistencia.',
);
if (process.argv[2] === 'before') {
  await mkdir('docs/evidence', { recursive: true });
  await writeFile(
    filename,
    JSON.stringify(
      {
        before: new Date().toISOString(),
        posts: data.items.map((p) => ({ id: p.id, body: p.body })),
      },
      null,
      2,
    ),
  );
  console.log(
    `Antes del reinicio: ${data.items.length} publicaciones registradas para comparación.`,
  );
} else {
  const saved = JSON.parse(await readFile(filename, 'utf8'));
  for (const p of saved.posts) {
    const response = await fetch(api + '/posts/' + p.id);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).body, p.body);
  }
  saved.after = new Date().toISOString();
  saved.verified = true;
  await writeFile(filename, JSON.stringify(saved, null, 2));
  console.log(
    `Persistencia verificada después del reinicio: ${saved.posts.length} publicaciones conservan identificador y contenido.`,
  );
}
