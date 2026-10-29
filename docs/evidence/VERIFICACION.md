# Verificación local - 28 de octubre de 2026

Entorno: Windows, Docker Desktop, PostgreSQL 17 en volumen persistente, API NestJS y frontend Next.js compilados en contenedores Linux.

## Resultados observados

- Compilación de frontend y backend: correcta, incluida comprobación TypeScript.
- Dockerfiles de API y frontend: construidos y ejecutados correctamente.
- Integración con PostgreSQL y dos usuarios temporales: 14 comprobaciones aprobadas, 0 fallos.
- Autenticación, duplicados y revocación de sesión: comprobados.
- Persistencia de hash scrypt y hash del token de sesión: comprobada sin exponer valores.
- Validaciones, CORS y origen de escrituras: comprobados.
- Restricción de eliminación a propietario de publicación/comentario: comprobada.
- Likes y seguimientos repetidos: no duplican registros.
- Feed personalizado: cambia al seguir/dejar de seguir.
- SSE: evento privado recibido por la primera sesión tras la interacción de la segunda; notificación persistida.
- SSR: el HTML de la publicación contiene el contenido real obtenido de PostgreSQL.
- Migraciones: base temporal vacía, inserción de registro previo, segunda migración conservando el registro y repetición sin duplicados.
- Persistencia después de reiniciar la aplicación: seis publicaciones conservan identificador y contenido. Ver `persistence.json`.
- Navegador: registro, creación de publicación, edición de biografía y consulta de comentarios/notificaciones.
- Responsive a 390 px: sin desbordamiento horizontal; navegación y cierre de sesión visibles.
- Swagger: documentación y OpenAPI accesibles localmente.

Las capturas actuales se renovaron el 29 de octubre con el sitio público en Render y dos cuentas de demostración. Los resultados locales anteriores se conservan como historial.

## Verificación pública - 29 de octubre de 2026

Frontend: https://nexo-web-ferotuc.onrender.com
Backend: https://nexo-api-ferotuc.onrender.com
Swagger: https://nexo-api-ferotuc.onrender.com/api/docs

Nueve comprobaciones públicas satisfactorias mediante `node scripts/verify-public.mjs --after-restart`. Se verificaron HTTPS, salud de PostgreSQL, Swagger/OpenAPI, autenticación y cookie Secure/HttpOnly, contenido SSR, SSE a través del proxy del frontend, interacciones y rechazo de operaciones inválidas/no autorizadas. Después de reiniciar la API en Render se conservó el identificador de la publicación original. El detalle está en `public-verification.json`.

Capturas 01 a 05: feed, perfil, viewport móvil de 390 px, notificaciones y Swagger públicos. No se afirma una prueba física desde teléfono. Los tres servicios son Free; PostgreSQL expira el 28 de noviembre de 2026.
