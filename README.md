# Nexo · Mini red social

Nexo permite crear una cuenta, compartir publicaciones con texto, emojis, imágenes y archivos, comentar, dar me gusta, seguir personas y consultar feeds general y personalizado. Las notificaciones de likes, comentarios y nuevos seguidores llegan mediante SSE y permanecen en PostgreSQL. Incluye chat privado entre dos personas, indicador En línea, mensajes leídos y adjuntos privados.

Proyecto final de Desarrollo Web · Francisco Fernando Otuc Chan.

La interfaz usa una identidad azul con fondos claros, tarjetas de mayor legibilidad, navegación activa resaltada y diseño adaptado a móvil.

## Estado y accesos

| Recurso          | Dirección                                        | Estado                       |
| ---------------- | ------------------------------------------------ | ---------------------------- |
| Código fuente    | https://github.com/Ferotuc/nexo-social           | Repositorio del proyecto     |
| Frontend local   | http://localhost:3100                            | Ejecución local              |
| Backend local    | http://localhost:4100/api/health                 | Ejecución local              |
| Swagger local    | http://localhost:4100/api/docs                   | Documentación interactiva    |
| OpenAPI JSON     | http://localhost:4100/api/openapi.json           | Contrato generado por NestJS |
| Frontend público | https://nexo-web-ferotuc.onrender.com            | HTTPS verificado             |
| Backend público  | https://nexo-api-ferotuc.onrender.com/api/health | API y PostgreSQL verificados |
| Swagger público  | https://nexo-api-ferotuc.onrender.com/api/docs   | Documentación pública        |

Desplegado el 29 de octubre de 2026 en Render: frontend y backend Docker separados, más PostgreSQL 17 administrado. Los tres recursos usan Free. La base gratuita caduca el **28 de noviembre de 2026**; los servicios pueden suspenderse por inactividad. Abrir frontend y API antes de presentar. Las direcciones localhost son una alternativa local.

## Tecnologías y arquitectura

- Next.js 16, React 19 y TypeScript: frontend responsive con SSR de feed, perfiles y publicaciones; login y registro prerenderizados.
- NestJS 11: backend REST separado, validación de DTO y documentación Swagger/OpenAPI.
- PostgreSQL 17: datos relacionales, claves foráneas, restricciones e índices.
- Drizzle ORM/Kit: esquema y migraciones versionadas. La API usa SQL parametrizado con node-postgres para las consultas y transacciones.
- SSE/EventSource: invalidación del feed, contadores y notificaciones privadas en vivo.
- Docker Compose y Dockerfiles: servicios reproducibles. Versiones exactas fijadas en package-lock.json.

```mermaid
flowchart LR
  B[Navegador] -->|HTML SSR y React| W[Next.js :3100]
  W -->|REST y proxy SSE /api| A[NestJS :4100]
  A -->|SQL parametrizado y transacciones| D[(PostgreSQL)]
  A -->|Drizzle: migraciones| D
  A --> S[Swagger /api/docs]
```

El navegador utiliza `/api` en el dominio del frontend. Next.js lo reenvía a la URL configurada del backend; así las cookies HttpOnly y EventSource funcionan en el mismo origen incluso cuando los servicios se alojan por separado. La API conserva su URL y Swagger públicos independientes. El origen autorizado es una lista explícita.

```text
apps/api/src/         controladores, servicio, DTO, seguridad y esquema
apps/api/drizzle/     SQL, snapshots y diario de tres migraciones
apps/web/app/         páginas SSR, login, registro y estilos
apps/web/components/ interfaz interactiva
tests/               integración real y evolución de migraciones
scripts/             arranque, persistencia y generación del informe
docs/evidence/       capturas y resultados reales
output/pdf/          informe de validación
```

## Instalación y ejecución local

Requiere Node.js 22 o superior, npm y Docker Desktop encendido. Puertos: 3100 frontend, 4100 API y 55432 PostgreSQL (solo loopback).

```powershell
git clone https://github.com/Ferotuc/nexo-social.git
cd nexo-social
Copy-Item .env.example .env
# Cambia change_me en POSTGRES_PASSWORD y DATABASE_URL por la misma clave local.
npm ci
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run build
```

En dos terminales, desde la raíz:

```powershell
npm run start -w apps/api
```

```powershell
npm run start -w apps/web
```

Alternativa en Windows: `./scripts/start-local.ps1` crea un entorno local con clave aleatoria si no existe, inicia PostgreSQL, aplica migraciones, compila cuando falta el build y abre ambos procesos en segundo plano. Los registros y PIDs están en `.local/`. Si cambias el código, ejecuta `npm run build` antes de reiniciar los procesos. No uses ambos métodos a la vez.

Registra tu propia cuenta en `/register`. El seed es opcional, crea cuatro perfiles y cinco publicaciones ilustrativas solo si la base está vacía. Esos perfiles no tienen contraseñas públicas y los datos se identifican como demostración. El seed no se ejecuta automáticamente al desplegar.

### Todo con contenedores

```powershell
docker compose --profile full up -d --build
# Opcional, una sola vez si la base está vacía:
docker compose exec api node dist/db/seed.js
```

La API aplica las migraciones al arrancar. PostgreSQL usa el volumen `nexo_data`; `docker compose down` conserva los datos. Eliminar el volumen elimina la base. No usar `down -v` para reinicios normales.

## Variables de entorno

| Variable                                        | Uso                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| DATABASE_URL                                    | Conexión PostgreSQL; secreto solo del backend                                           |
| POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB | Inicialización de PostgreSQL local                                                      |
| API_PORT o PORT                                 | Puerto del backend; PORT tiene prioridad en cloud                                       |
| WEB_ORIGIN                                      | Orígenes frontend permitidos, separados por coma, sin `/` final                         |
| API_PUBLIC_URL                                  | Origen público propio del backend para permitir Swagger desde su dominio                |
| API_INTERNAL_URL                                | Dirección del backend vista por Next.js; también se usa al compilar las reglas de proxy |
| COOKIE_SECURE                                   | `false` solo con HTTP local; `true` con HTTPS en producción                             |
| TRUST_PROXY                                     | `true` detrás de un único proxy de confianza, como Render                               |

`.env` no se sube a Git. El frontend no recibe DATABASE_URL ni credenciales. Al cambiar API_INTERNAL_URL en alojamiento, reconstruir el frontend para actualizar el proxy.

## Datos y migraciones

Tablas: `users`, `sessions`, `posts`, `comments`, `likes`, `follows`, `notifications`, `messages` y `attachments`.

- Migración `0000`: usuarios, sesiones, publicaciones e interacciones, con unicidad de email/usuario y pares like/seguimiento; prohíbe auto-seguimiento.
- Migración `0001`: agrega notificaciones persistidas, claves foráneas, restricción de tipos e índice por destinatario y fecha. No modifica ni elimina publicaciones anteriores.

```powershell
# Después de editar apps/api/src/db/schema.ts:
npm run db:generate
npm run db:migrate
```

Conservar SQL, snapshots y `meta/_journal.json` en Git. No editar una migración ya aplicada ni hacer cambios manuales de esquema. Para conexiones cloud, usar la configuración TLS exigida por el proveedor y no desactivar la verificación de certificados.

- Migración `0002`: mensajes privados y adjuntos persistentes con claves foráneas, índices y límites de tamaño.

## Chat, emojis y adjuntos

Entra a **Mensajes**, busca una persona y abre su conversación. El punto verde indica una conexión SSE activa; también puedes dejar mensajes cuando la persona está desconectada. Desde un perfil puedes pulsar **Enviar mensaje**. El historial persiste y carga páginas de 50 mensajes. Los avisos de mensajes y lectura viajan únicamente a los participantes.

Usa la carita para insertar emojis y el clip para adjuntar **PNG, JPG, WebP, PDF o TXT UTF-8**. Hasta **3 archivos de 2 MB** por publicación/mensaje, con cuotas de **20 MB por usuario y 100 MB compartidos**. Los bytes se guardan en PostgreSQL (`bytea`), por lo que no desaparecen al reiniciar el contenedor gratuito. Los adjuntos de publicaciones son públicos; los del chat exigen la sesión de uno de sus participantes. Se verifica contenido/extensión y se fuerzan descargas de PDF/TXT. No hay análisis antivirus ni cifrado de extremo a extremo. Para crecimiento real debe migrarse el almacenamiento a objetos y mantener la autorización del chat en el backend.

Los archivos cargados pero no enviados solo son visibles para su propietario; se descartan al quitarlos y se limpian después de una hora cuando se vuelve a subir un archivo. No se aceptan SVG, HTML, ejecutables ni ZIP.

## API y documentación

Abrir `/api/docs` en frontend o backend y `/api/openapi.json` para el contrato. Incluye autenticación, usuarios, publicaciones, comentarios, interacciones, notificaciones, salud y SSE. Login/registro establecen cookie HttpOnly; Swagger permite probar acciones autenticadas desde ese mismo origen sin copiar tokens.

| Grupo          | Operaciones                                                                             |
| -------------- | --------------------------------------------------------------------------------------- |
| Autenticación  | POST `/api/auth/register`, `/login`, `/logout`; GET `/api/auth/me`                      |
| Usuarios       | GET `/api/users?q=`, GET `/api/users/:username`, PATCH `/api/users/me`                  |
| Seguimiento    | POST/DELETE `/api/users/:id/follow`                                                     |
| Publicaciones  | GET/POST `/api/posts`, GET/DELETE `/api/posts/:id`                                      |
| Feed           | GET `/api/posts?feed=general`, `?feed=following`, `?username=...`, `&page=2`            |
| Likes          | PUT/DELETE `/api/posts/:id/like`                                                        |
| Comentarios    | GET/POST `/api/posts/:id/comments`, DELETE `/api/comments/:id`                          |
| Notificaciones | GET `/api/notifications`, PATCH `/api/notifications/read`                               |
| Tiempo real    | GET `/api/events` autenticado, `text/event-stream`                                      |
| Chat privado   | GET `/api/chat/contacts`, GET/POST `/api/chat/:id/messages`, PATCH `/api/chat/:id/read` |
| Archivos       | POST `/api/attachments` (multipart), GET/DELETE `/api/attachments/:id`                  |

El feed devuelve hasta 15 publicaciones por página; comentarios hasta 100 por publicación y notificaciones las 50 más recientes. La búsqueda descubre hasta 12 personas por consulta. Errores coherentes: 400 datos inválidos, 401 sin sesión, 403 sin permiso, 404 inexistente, 409 duplicado, 413 tamaño excedido y 429 exceso de solicitudes.

## Seguridad y tiempo real

Contraseñas con scrypt y sal aleatoria; comparación en tiempo constante. Tokens de sesión aleatorios de 256 bits, con SHA-256 guardado en la base, expiración de siete días y revocación al cerrar sesión. Cookie HttpOnly/SameSite=Lax y Secure en producción. Validación estricta rechaza campos extra, SQL parametrizado, autorización de propietario en borrados, límites de tamaño/frecuencia, Helmet y control de origen para escrituras. React escapa el texto de los usuarios; no se acepta HTML.

Los likes y seguimientos son idempotentes. Cada mutación social y su notificación se guardan en una transacción; el evento se emite después del COMMIT. Cada usuario recibe solo invalidaciones de sus notificaciones. El frontend vuelve a pedir estado REST al conectar/reconectar, evita aplicar eventos duplicados como datos y cierra EventSource al desmontarse. Heartbeat cada 20 segundos y revisión de sesión cada minuto.

El bus SSE es de una sola instancia. Para escalar el backend a varias réplicas hay que agregar un bus compartido (Redis Pub/Sub o equivalente). Un reinicio puede perder la emisión en tránsito, pero no la notificación persistida; al reconectar se recupera desde REST. El chat envía acciones mediante REST y recibe avisos privados por SSE; el indicador de presencia es aproximado y usa conexiones activas de una sola instancia.

## Pruebas y evidencia

### Formato del código

Prettier está configurado en la raíz para TypeScript, TSX, JavaScript, CSS, JSON, YAML y Markdown. Las reglas están en `.prettierrc.json`; `.editorconfig` mantiene UTF-8, finales LF y sangría consistente. Se excluyen secretos, dependencias, compilaciones, migraciones generadas y evidencias.

```powershell
npm run format        # Aplicar formato
npm run format:check  # Verificar sin modificar archivos
```

GitHub Actions ejecuta la verificación de formato antes de compilar. Para formatear al guardar en VS Code, instala la extensión oficial de Prettier, selecciónala como formateador predeterminado y activa Format On Save.

Con PostgreSQL, frontend y API activos:

```powershell
npm test
npm run test:migrations
node scripts/persistence.mjs before
# Reiniciar API y PostgreSQL sin eliminar el volumen.
node scripts/persistence.mjs after
```

Las dos suites de integración usan cuentas temporales propias (dos y tres usuarios), comprueba hash/sesiones, permisos, REST, SSR, SSE real, unicidad e interacciones; elimina sus datos al finalizar. La prueba de migraciones crea y elimina únicamente una base temporal con prefijo `nexo_verify_`. No ejecutar estas pruebas contra producción: requieren permisos de desarrollo y borran sus fixtures.

Capturas y resultados se guardan en `docs/evidence`. El script `scripts/build-report.py` genera el informe con nombre y carné a partir de datos locales privados y enlaces públicos verificados. El PDF no se publica en el repositorio. Se aprobaron 9 comprobaciones públicas mediante `node scripts/verify-public.mjs --after-restart`, incluida persistencia después de reiniciar la API alojada. El script crea dos cuentas de demostración y sus interacciones; no elimina datos de terceros. Guarda sus credenciales solamente en `.local/` (ignorado por Git).

Además se verificaron **26 resultados locales (24 casos y 2 grupos), sin fallos**, incluyendo privacidad frente a una tercera cuenta, archivos falsos/grandes, transacciones, mensajes leídos y paginación sin omisiones. La ampliación pública se comprueba con `node scripts/verify-communications.mjs`; sus evidencias están en `docs/evidence/communications-public.json`. Consultar [la revisión completa de requisitos](docs/REVISION-REQUISITOS.md).

## Despliegue

La configuración realizada está en [docs/DEPLOY.md](docs/DEPLOY.md) y [docs/ARQUITECTURA-PUBLICA.md](docs/ARQUITECTURA-PUBLICA.md). `render.yaml` permite reproducir la arquitectura en otra instalación; no crear recursos duplicados para esta entrega. GitHub almacena el código; Render ejecuta las aplicaciones y PostgreSQL.

README, `docs/links.json`, capturas y PDF contienen las URLs reales. Puedes abrir el frontend desde un teléfono con Internet y registrar tu cuenta. Se verificó el acceso HTTPS público y una vista responsive de 390 px; conviene ensayar también en tu teléfono antes de exponer.
