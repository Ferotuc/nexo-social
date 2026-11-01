# S12 Migraciones con Drizzle ORM

La tarea utiliza el recurso **publicaciones** de Nexo. La API está escrita en TypeScript con NestJS y PostgreSQL. Drizzle define el esquema y aplica las migraciones; las consultas del servicio usan SQL parametrizado con `node-postgres`.

## CRUD principal

| Método | Ruta             | Resultado esperado                         |
| ------ | ---------------- | ------------------------------------------ |
| GET    | `/api/posts`     | 200, colección paginada                    |
| GET    | `/api/posts/:id` | 200, registro individual; 404 si no existe |
| POST   | `/api/posts`     | 201, publicación creada                    |
| PATCH  | `/api/posts/:id` | 200, texto actualizado por su propietario  |
| DELETE | `/api/posts/:id` | 204, sin cuerpo de respuesta               |

El registro y el login establecen la cookie HttpOnly necesaria para escribir. El servidor obtiene el autor desde la sesión. `body` debe contener entre 1 y 2000 caracteres después de quitar espacios exteriores. Datos inválidos producen 400, ausencia de sesión 401 y modificaciones de publicaciones ajenas 403. No se aceptan campos adicionales para cambiar el autor o el identificador.

## Migraciones versionadas

1. `0000_melodic_hex.sql`: modelo inicial con usuarios, sesiones, publicaciones, comentarios, likes y follows.
2. `0001_slippery_leper_queen.sql`: evolución mediante notificaciones relacionadas con usuarios y publicaciones, restricción de tipos e índice por destinatario y fecha. Conserva las publicaciones existentes.
3. `0002_romantic_vapor.sql`: ampliación posterior de Nexo con mensajes y adjuntos. Se conserva en el historial; S12 se centra en las primeras dos migraciones.

Se versionan los SQL, snapshots y `meta/_journal.json`. La tabla `drizzle.__drizzle_migrations` registra las migraciones ejecutadas. No se editan migraciones aplicadas ni se sustituye el historial con cambios manuales o `push`.

## Instalación y ejecución

Seguir la configuración del [README](../README.md). Requiere Node.js 22 o superior, npm y Docker Desktop.

```powershell
npm ci
Copy-Item .env.example .env
# Configurar la misma clave privada local en POSTGRES_PASSWORD y DATABASE_URL.
docker compose --profile full up -d --build
npm run db:migrate
```

Este recorrido inicia la API y PostgreSQL en contenedores, como en la evidencia del reinicio, y también levanta el frontend de Nexo. La API local utiliza `http://localhost:4100`, Swagger `/api/docs` y salud `/api/health`. `.env` y las credenciales no se guardan en Git. El frontend no es requisito de S12. La API aplica las migraciones al arrancar; el comando explícito `db:migrate` comprueba que repetirlas no duplica el historial.

## Generar y aplicar cambios nuevos

```powershell
# Editar primero apps/api/src/db/schema.ts.
npm run db:generate
# Revisar el SQL y conservar schema.ts, SQL, snapshots y _journal.json en Git.
npm run db:migrate
```

`generate` compara el esquema TypeScript con los snapshots. `db:migrate` ejecuta `migrate()` de Drizzle ORM con la conexión configurada, aplicando únicamente migraciones pendientes.

## Reproducir las evidencias de S12

Los siguientes comandos usan únicamente localhost y crean datos identificados como demostración. El script de migraciones crea y elimina solo una base temporal `nexo_verify_*`.

```powershell
node scripts/s12-evidence.mjs generate
node scripts/s12-evidence.mjs before
docker compose restart api
node scripts/s12-evidence.mjs after
```

La generación se reproduce en una carpeta temporal a partir del esquema inicial y su evolución, sin tocar las migraciones ya aplicadas. Se compara el SQL generado con los archivos del repositorio. La prueba aplica primero una migración, inserta una publicación, aplica la segunda y comprueba el mismo ID y contenido; después valida también la tercera y la repetición sin duplicados.

La prueba HTTP crea, consulta, lista y actualiza una publicación. Tras reiniciar únicamente la API, verifica el ID y texto conservados; finalmente elimina esa publicación propia y comprueba 404. Las credenciales de demostración se guardan solo en `.local/`. Los resultados sin secretos y las capturas están en `docs/evidence/s12/` y `docs/evidence/s12-migrations.json`.

Para consultar las evidencias registradas en un visor de solo lectura:

```powershell
node scripts/s12-viewer.mjs
# Abrir http://127.0.0.1:3218/generation-initial
```

## Entrega

El informe independiente incluye el enlace al repositorio, capturas de generación y aplicación, operaciones CRUD, persistencia tras reiniciar y explicación de la evolución. El PDF es el formato solicitado por Canvas; la copia Word permite editar la presentación. Los documentos con nombre y carné se entregan como archivos locales, sin publicarlos en GitHub.
