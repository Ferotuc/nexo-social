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

Los usuarios ilustrativos y las interacciones de las capturas son datos de demostración locales.

## Pendiente

No se ha desplegado en un proveedor público: falta una cuenta de alojamiento para frontend, API y PostgreSQL. No hay URLs de producción verificadas. El repositorio GitHub no sustituye este requisito.
