# Despliegue de Nexo

## Estado

**Desplegado y verificado el 29 de octubre de 2026.** Frontend: https://nexo-web-ferotuc.onrender.com; backend: https://nexo-api-ferotuc.onrender.com; Swagger: https://nexo-api-ferotuc.onrender.com/api/docs. Tres recursos Free en Oregon: `nexo-web-ferotuc`, `nexo-api-ferotuc` y `nexo-db-ferotuc` (PostgreSQL 17). No se contrataron planes de pago. La base expira el **28 de noviembre de 2026**.

Se crearon los servicios Docker desde la URL pública de GitHub, rama `main`, raíz del repositorio, usando `apps/web/Dockerfile` y `apps/api/Dockerfile`. Se configuraron las variables indicadas abajo y se bloquearon todas las conexiones externas a PostgreSQL. La API utiliza la conexión interna secreta. Las migraciones se aplicaron al arrancar. Se verificaron 9 comprobaciones públicas y persistencia tras reiniciar el backend; evidencia en `docs/evidence/public-verification.json`.

## Reproducir en otra instalación de Render

No ejecutar este recorrido para los servicios ya creados: produciría recursos duplicados. El despliegue actual se creó manualmente desde la URL pública del repositorio. El Blueprint es una alternativa reproducible.

1. Acceder a Render con la cuenta elegida y usar el repositorio `Ferotuc/nexo-social`.
2. Crear un Blueprint desde el repositorio y seleccionar `render.yaml`. Revisar el precio y las limitaciones antes de crear recursos. El archivo propone planes free; su disponibilidad depende de la cuenta y del proveedor.
3. Establecer en la API `WEB_ORIGIN` con la URL final HTTPS del frontend y `API_PUBLIC_URL` con la URL final HTTPS del backend. No incluir `/` al final. El Blueprint conecta `DATABASE_URL` a PostgreSQL; no copiarla a documentos ni al frontend.
4. En el frontend establecer `API_INTERNAL_URL` con la URL HTTPS de la API. Debe estar presente durante build y runtime; reconstruir el frontend tras cambiarla, pues Next.js compila el proxy.
5. La API ejecuta sus migraciones al arrancar. En producción requiere `NODE_ENV=production`, `COOKIE_SECURE=true` y `TRUST_PROXY=true` detrás del proxy del proveedor.
6. Los Dockerfiles escuchan en `0.0.0.0`; la API respeta `PORT`. El frontend standalone respeta el `PORT` del entorno y usa 3100 si no se cambia.
7. Probar frontend, registro/login, nueva publicación, comentario con una segunda cuenta, notificación en vivo y acceso público a `/api/docs` y `/api/health` de la API.
8. Guardar las URLs reales en `docs/links.json`, el README y el PDF. Las URLs asignadas pueden tener sufijos; no asumir que coinciden con los nombres del Blueprint.

El plan gratuito de Render suspende los servicios inactivos y PostgreSQL gratuito tiene duración limitada. Para un servicio permanente se necesita un plan adecuado. Consultar el estado y condiciones vigentes en la [documentación oficial](https://render.com/docs/free). Revisar también la [especificación de Blueprints](https://render.com/docs/blueprint-spec).

No activar varias réplicas de la API mientras el bus SSE permanezca en memoria. Para varias réplicas debe agregarse un mecanismo compartido de eventos.

## VPS alternativo

Instalar Docker y desplegar con `docker compose --profile full up -d --build`, PostgreSQL persistido y copias de seguridad. Situar frontend y backend detrás de un proxy HTTPS (Caddy/Nginx), configurar orígenes y cookies de producción. Mantener PostgreSQL sin exposición pública; el compose lo enlaza solo a loopback. Restringir puertos API/frontend por firewall cuando el proxy resida en el mismo equipo.

La aplicación guarda publicaciones de texto; no depende de almacenamiento efímero del servidor para los datos. Si se incorpora multimedia después, usar almacenamiento de objetos y validar los archivos.
