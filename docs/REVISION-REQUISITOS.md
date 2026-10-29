# Revisión del proyecto final Nexo

Revisión del 29 de octubre de 2026 contra el enunciado proporcionado por el estudiante. La cobertura indicada describe implementación y comprobaciones; no sustituye la calificación del docente.

| Requisito | Estado | Evidencia |
|---|---|---|
| Cliente y servidor separados; REST | Implementado | `apps/web` (Next.js), `apps/api` (NestJS), controladores REST |
| Base relacional y migraciones reproducibles | Implementado y probado | PostgreSQL 17, nueve tablas y migraciones 0000, 0001 y 0002; `tests/migrations.mjs` |
| Registro e inicio de sesión | Implementado y probado | Sesiones revocables y cookies; pruebas de duplicados, login y logout |
| Contraseñas protegidas | Implementado y probado | scrypt con sal individual; hashes de contraseñas y tokens persistidos |
| Crear, ver y eliminar publicaciones | Implementado y probado | Texto/emojis y hasta tres adjuntos; permisos de propietario y borrado en cascada |
| Likes, comentarios y seguimiento | Implementado y probado | Restricciones de unicidad, operaciones idempotentes y transacciones |
| Feed general y personalizado | Implementado y probado | Feed paginado de comunidad y de personas seguidas |
| Pantallas de acceso, feed y perfil | Implementado | Interfaz responsive azul; edición de perfil propio |
| SSR o prerender recomendado | Implementado y probado | SSR de feed, perfiles y publicaciones; acceso/registro prerenderizados |
| Frontend conectado al backend desplegado | Implementado y probado | Proxy REST y SSE de Next.js hacia API pública HTTPS |
| Tiempo real | Implementado y probado | SSE autenticado para notificaciones, contadores, chat y lectura |
| Validación y errores coherentes | Implementado y probado | DTO estrictos, UUID, longitudes, códigos HTTP y rechazo de campos extra |
| CORS, origen y secretos | Implementado y probado | Orígenes explícitos, cookie Secure/HttpOnly, `.env.example`; secretos fuera de Git |
| Swagger/OpenAPI público | Implementado y probado | [Swagger](https://nexo-api-ferotuc.onrender.com/api/docs), `/api/openapi.json`, rutas de chat/adjuntos incluidas |
| Frontend público | Desplegado y probado | [Aplicación](https://nexo-web-ferotuc.onrender.com) en Render Free |
| Backend público | Desplegado y probado | [Salud de API y PostgreSQL](https://nexo-api-ferotuc.onrender.com/api/health) |
| GitHub: código, README, tecnologías y arquitectura | Disponible | [Repositorio](https://github.com/Ferotuc/nexo-social), README y `docs/ARQUITECTURA-PUBLICA.md` |
| GitHub: variables de ejemplo y migraciones | Disponible | `.env.example` y `apps/api/drizzle/`; sin credenciales reales |
| PDF con identidad, arquitectura, tecnologías y capturas | Generado localmente | `output/pdf/Nexo-Proyecto-Final.pdf`; no se publica el carné en GitHub |
| PDF con enlaces a repositorio, frontend, backend y API | Incluido | Enlaces clicables en el informe de entrega |
| Entrega del PDF en Canvas antes del 31 de octubre | A cargo del estudiante | El despliegue y el PDF no equivalen a subir la tarea a Canvas |

## Criterios de evaluación

Los seis criterios tienen implementación y evidencia: frontend (3), API/backend (3), tiempo real (2), seguridad/validación (2), datos/migraciones (2), despliegue (3). La rúbrica suma 15 puntos; la nota la asigna el docente.

## Ampliaciones solicitadas

- Selector de emojis en publicaciones, comentarios y mensajes.
- Imágenes PNG/JPG/WebP y archivos PDF/TXT UTF-8 en publicaciones y chat.
- Chat privado individual, indicador En línea, historial paginado, pendientes y lectura.
- Adjuntos privados protegidos en el backend: una tercera cuenta no puede descargarlos.
- Persistencia de bytes en PostgreSQL, sin depender del disco efímero del servicio web.

## Comprobaciones

`npm test`: 26 resultados aprobados (24 casos y 2 grupos), cero fallos. Incluye tres cuentas para verificar privacidad, firma/extensión y tamaño de archivos, apropiación indebida de adjuntos, rollback, SSE privado, lectura y paginación cuando coinciden fechas. La prueba de migraciones conserva un registro previo y verifica las tres migraciones sin duplicados.

Las comprobaciones públicas de la versión base están en `docs/evidence/public-verification.json`; las de chat y multimedia, en `docs/evidence/communications-public.json`. Los scripts públicos usan únicamente cuentas identificadas como demostración y guardan sus credenciales en `.local/`, ignorado por Git.

## Límites que debes explicar

Render Free puede suspender los servicios por inactividad. La base gratuita expira el **28 de noviembre de 2026**. No garantiza disponibilidad permanente. Abrir los enlaces antes de presentar y ensayar desde tu teléfono con datos móviles; las capturas móviles corresponden a un viewport simulado.

Máximo tres archivos de 2 MB por envío, 20 MB por usuario y 100 MB compartidos. No se admiten todos los formatos. No hay análisis antivirus ni cifrado de extremo a extremo. El acceso privado lo aplica la API y el transporte público usa HTTPS.

La presencia es aproximada y depende de conexiones SSE activas. Se puede dejar un mensaje a una persona desconectada. La API usa una sola instancia; varias réplicas requieren un bus compartido para chat y presencia.
