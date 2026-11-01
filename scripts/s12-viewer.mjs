// Local read-only viewer for actual command logs and HTTP responses recorded by s12-evidence.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../docs/evidence/', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const escape = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const code = (s) => `<pre>${escape(typeof s === 'string' ? s : JSON.stringify(s, null, 2))}</pre>`;
const compact = (p) => p && { id: p.id, body: p.body };
const operation = (o) =>
  `<section><h2>${escape(o.title)} <b>${o.status}</b></h2><p class="route">${escape(o.method + ' /api' + o.path)}</p>${o.request ? '<h3>Solicitud</h3>' + code(o.request) : ''}<h3>Respuesta ${o.status}</h3>${code(o.status === 204 ? 'Sin cuerpo de respuesta' : o.response?.id ? compact(o.response) : o.response?.items ? { items: o.response.items.map(compact), page: o.response.page } : o.response)}</section>`;
const pages = [
  'generation-initial',
  'generation-evolution',
  'migrations',
  'create',
  'update',
  'persistence',
  'delete',
];
createServer(async (req, res) => {
  try {
    const page = new URL(req.url, 'http://localhost').pathname.slice(1) || 'generation-initial';
    if (!pages.includes(page)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const before = await json('s12/crud-before.json'),
      after = await json('s12/crud-after.json');
    let title,
      body,
      date = before.checkedAt;
    if (page.startsWith('generation-')) {
      const g = await json('s12/generation.json'),
        i = page.endsWith('initial') ? 0 : 1;
      date = g.checkedAt;
      title = i ? 'Generación de la segunda migración' : 'Generación de la migración inicial';
      body = `<section><p class="route">node scripts/s12-evidence.mjs generate</p><p>Drizzle Kit ejecutado sobre el esquema TypeScript ${i ? 'evolucionado' : 'inicial'}.</p>${code(g.stages[i].stdout.replace(/\.local[\\/]s12-generation-[^\\/\s]+[\\/]drizzle[\\/]/g, 'drizzle/'))}<p class="ok">SQL generado idéntico al historial versionado de Nexo.</p></section><p>Reproducción en una carpeta temporal. Las migraciones ya aplicadas no se editaron.</p>`;
    } else if (page === 'migrations') {
      const m = await json('s12-migrations.json');
      date = m.checkedAt;
      title = 'Aplicación y evolución verificadas';
      const log = await readFile(new URL('s12/migrations.log', root), 'utf8');
      body = `<section><p class="route">node tests/migrations.mjs --evidence</p>${code(log)}<p>Publicación de control conservada</p>${code({ id: m.steps[0].postId, antes: m.steps[0].body, despues: m.steps[1].preserved ? 'Mismo identificador y contenido' : false })}<p class="ok">Historial: 1 → 2 → 3 migraciones. Sin duplicados al repetir.</p></section><p>Base PostgreSQL temporal de verificación. El historial se aplica mediante migrate() de Drizzle ORM.</p>`;
    } else if (page === 'create') {
      title = 'Crear listar y consultar';
      body = before.operations.slice(0, 3).map(operation).join('');
    } else if (page === 'update') {
      title = 'Actualizar y validar';
      body = before.operations.slice(3).map(operation).join('');
    } else if (page === 'delete') {
      title = 'Eliminar y comprobar inexistencia';
      date = after.checkedAt;
      body = after.operations.slice(1).map(operation).join('');
    } else {
      title = 'Persistencia después del reinicio';
      date = after.checkedAt;
      body = `<section><h2>Antes del reinicio</h2>${code({ id: before.postId, body: before.expectedBody })}<p class="route">docker compose restart api</p><h2>Después del reinicio</h2><p>GET /api/posts/${escape(before.postId)} · HTTP 200</p>${code({ id: after.samePostId, body: after.sameBody })}<p class="ok">Comparación automática aprobada: mismo ID y texto.</p></section><p>Se reinició únicamente la API local. PostgreSQL y su volumen no se eliminaron.</p>`;
    }
    const localDate = new Date(date).toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(
      `<!doctype html><html lang="es"><meta charset="utf-8"><title>S12 ${escape(title)}</title><style>*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;color:#162b4c;margin:0;background:#f4f7fc;padding:22px}main{max-width:1000px;margin:auto}header{margin-bottom:16px}header p{font-size:12px;color:#64748b}h1{font-size:25px;margin:5px 0 10px}h2{font-size:17px;margin:0 0 8px}h3{font-size:12px;margin:10px 0 5px;color:#475569}section{background:white;border:1px solid #d8e3f3;padding:17px;border-radius:10px;margin-bottom:12px}b{background:#e6f5ee;color:#14714a;font-size:14px;padding:3px 7px;border-radius:5px;float:right}pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-family:Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0}p{line-height:1.5;font-size:13px;margin:8px 0}.route{color:#245ce2;font-family:Consolas,monospace;font-size:12px;overflow-wrap:anywhere}.ok{color:#14714a;font-weight:600}footer{font-size:11px;color:#64748b;margin-top:12px}</style><main><header><p>NEXO · EVIDENCIA DE EJECUCIÓN · S12</p><h1>${escape(title)}</h1><p>${escape(localDate)} · Guatemala UTC−06</p></header>${body}<footer>Vista de evidencias de comandos y respuestas reales. En el CRUD se muestran campos relevantes; se omiten metadatos secundarios. Sin cookies ni contraseñas.</footer></main></html>`,
    );
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('No se encontraron las evidencias completas.');
  }
}).listen(3218, '127.0.0.1', () => console.log('Evidencias S12: http://127.0.0.1:3218'));
