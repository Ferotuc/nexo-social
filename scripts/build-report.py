"""Generate the delivery report from real screenshots and deployment links.

Copy docs/student.example.json to .local/student.json and fill the student data.
The PDF stays local (gitignored); do not expose a student identifier in a public repo.
"""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, Flowable
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/Nexo-Proyecto-Final.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
student_path=ROOT/'.local/student.json'
student=json.loads(student_path.read_text(encoding='utf-8-sig')) if student_path.exists() else {'name':'Estudiante','studentId':'Sin configurar'}
links=json.loads((ROOT/'docs/links.json').read_text(encoding='utf-8-sig'))
public=all(links.get(k) for k in ['frontend','backend','swagger'])
font='Helvetica'; bold='Helvetica-Bold'
font_dir=Path('C:/Windows/Fonts')
if (font_dir/'segoeui.ttf').exists():
    pdfmetrics.registerFont(TTFont('Segoe',str(font_dir/'segoeui.ttf')))
    pdfmetrics.registerFont(TTFont('SegoeBold',str(font_dir/'segoeuib.ttf')))
    font='Segoe'; bold='SegoeBold'
GREEN=colors.HexColor('#245ce2'); INK=colors.HexColor('#172b4d'); MUTED=colors.HexColor('#60728e')
SAGE=colors.HexColor('#edf3ff'); LINE=colors.HexColor('#dce7f8'); ORANGE=colors.HexColor('#3278ed')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='KickerN',fontName=bold,fontSize=8,textColor=ORANGE,spaceAfter=15,leading=12))
styles.add(ParagraphStyle(name='TitleN',fontName=bold,fontSize=38,leading=43,textColor=GREEN,spaceAfter=13))
styles.add(ParagraphStyle(name='H1N',fontName=bold,fontSize=23,leading=29,textColor=GREEN,spaceAfter=18))
styles.add(ParagraphStyle(name='H2N',fontName=bold,fontSize=13,leading=19,textColor=INK,spaceBefore=15,spaceAfter=9))
styles.add(ParagraphStyle(name='BodyN',fontName=font,fontSize=10,leading=16,textColor=INK,spaceAfter=10))
styles.add(ParagraphStyle(name='SmallN',fontName=font,fontSize=8,leading=12,textColor=MUTED,spaceAfter=8))
styles.add(ParagraphStyle(name='TableN',fontName=font,fontSize=8,leading=12,textColor=INK))
story=[]
def p(text,kind='BodyN'): return Paragraph(text,styles[kind])
def add(text,kind='BodyN'):story.append(p(text,kind))
def table(rows,widths):
    t=Table([[p(str(c),'TableN') for c in row] for row in rows],colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),SAGE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,LINE),('LINEBELOW',(0,1),(-1,-1),.4,LINE),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    story.append(t)
def screenshot(name,max_h=365,max_w=499):
    path=ROOT/'docs/evidence'/name
    if not path.exists(): raise FileNotFoundError(f'Falta evidencia real: {path}')
    w,h=ImageReader(str(path)).getSize();scale=min(max_w/w,max_h/h)
    image=Image(str(path),width=w*scale,height=h*scale);image.hAlign='CENTER';story.append(image);story.append(Spacer(1,13))
def page(kicker,title):
    if story:story.append(PageBreak())
    add(kicker,'KickerN');add(title,'H1N')
class Architecture(Flowable):
    def __init__(self):super().__init__();self.width=499;self.height=110
    def draw(self):
        c=self.canv
        boxes=[(0,'Navegador','React + interfaz'),(175,'Frontend','Next.js / SSR'),(350,'Backend','NestJS / REST')]
        for x,title,sub in boxes:
            c.setFillColor(SAGE);c.setStrokeColor(LINE);c.roundRect(x,51,148,49,7,fill=1,stroke=1)
            c.setFillColor(GREEN);c.setFont(bold,10);c.drawCentredString(x+74,80,title)
            c.setFillColor(MUTED);c.setFont(font,8);c.drawCentredString(x+74,65,sub)
        c.setStrokeColor(ORANGE)
        for x in [149,324]:
            c.line(x+2,75,x+23,75);c.line(x+19,79,x+23,75);c.line(x+19,71,x+23,75)
        c.line(424,50,424,31);c.line(424,31,248,31)
        c.setFillColor(GREEN);c.roundRect(175,1,148,36,6,fill=1,stroke=0)
        c.setFillColor(colors.white);c.setFont(bold,9);c.drawCentredString(249,22,'PostgreSQL')
        c.setFont(font,7);c.drawCentredString(249,10,'Drizzle / datos persistentes')

add('DESARROLLO WEB / PROYECTO FINAL / 2026','KickerN')
add('nexo.','TitleN')
add('Una mini red social para conectar ideas y personas.','H1N')
add(escape(student['name']),'BodyN');add('Carné: '+escape(student['studentId']),'BodyN')
add('Entrega: 31 de octubre de 2026.','SmallN')
status='DESPLIEGUE HTTPS VERIFICADO / RENDER FREE / 29 OCT 2026' if public else 'VALIDACIÓN LOCAL COMPLETA · DESPLIEGUE PÚBLICO PENDIENTE'
table([['ESTADO DEL PROYECTO'],[status]],[499]);story.append(Spacer(1,14))
add('Objetivo','H2N')
add('Integrar frontend, backend, datos relacionales, seguridad, documentación y tiempo real en una aplicación cliente-servidor. Nexo permite registrarse, publicar texto e imágenes, intercambiar mensajes privados, conversar en comentarios, seguir personas y recibir notificaciones instantáneas.')
add('Arquitectura','H2N');story.append(Architecture())
add('El navegador consume /api en el origen del frontend. Next.js lo reenvía al backend separado. NestJS valida la sesión y las solicitudes; PostgreSQL guarda el estado. SSE informa cambios para recuperar el estado actualizado mediante REST.','SmallN')

page('01 / IMPLEMENTACIÓN','Funciones, datos y seguridad')
table([['Capa','Implementación'],['Frontend','Next.js 16, React 19 y TypeScript; SSR de feed/perfiles/publicaciones, registro y login prerenderizados. Diseño responsive.'],['Backend','NestJS 11, API REST, DTO con validación estricta, errores coherentes y Swagger/OpenAPI.'],['Datos','PostgreSQL 17, Drizzle ORM/Kit, SQL parametrizado, restricciones y transacciones.'],['Tiempo real','SSE autenticado: likes, comentarios, seguimiento, chat privado y contadores; reconexión y recuperación mediante REST.'],['Ejecución','Render Free: dos servicios Docker y PostgreSQL administrado. Docker Compose para reproducción local.']],[90,409])
add('Modelo relacional','H2N')
add('users y sessions gestionan cuentas y acceso; posts y comments guardan el contenido; likes y follows usan claves compuestas para evitar duplicados; notifications conserva el historial de actividad por destinatario.')
add('Tres migraciones reproducibles','H2N')
add('La primera crea el modelo social y sus restricciones. La segunda incorpora notificaciones persistentes e índices. La tercera agrega mensajes privados y archivos persistentes. Se verificó la evolución sobre una base con un registro previo y se conservó su contenido; repetir las migraciones no duplicó el historial.')
add('Controles implementados','H2N')
add('Hash scrypt con sal individual; tokens aleatorios cuyo hash se guarda en la base; cookie HttpOnly y SameSite, con Secure obligatorio en producción; sesión revocable; validaciones de entrada y propiedad de recursos; protección de origen/CORS, límites de frecuencia y tamaño. Las credenciales reales permanecen fuera de Git.')
add('Alcance ampliado: publicaciones con imágenes/archivos, emojis y chat privado con presencia y lectura, además de notificaciones y contadores en vivo. El bus SSE corresponde a una instancia de API; varias réplicas requieren un bus compartido.','SmallN')

page('02 / EVIDENCIA REAL','Feed y publicaciones')
screenshot('01-feed-desktop.jpg',max_h=385)
add('Figura 1. Feed de escritorio, sesión iniciada y publicación pública persistida. Los datos mostrados se consultan desde PostgreSQL.','SmallN')
add('Flujos disponibles','H2N')
add('Creación y eliminación de publicaciones propias con texto y hasta tres adjuntos; feed general y de personas seguidas; likes idempotentes; comentarios y acceso a la conversación mediante enlace. Las capturas corresponden al despliegue público con dos cuentas de demostración, sin contraseñas públicas.')
add('Renderizado y recuperación','H2N')
add('El HTML inicial incluye publicaciones reales renderizadas en el servidor. Los cambios sociales se reflejan mediante SSE sin recargar y el estado vuelve a consultarse después de una reconexión.')

page('03 / EVIDENCIA REAL','Perfil y experiencia móvil')
screenshot('02-profile-desktop.jpg',max_h=285)
add('Figura 2. Perfil con biografía, estadísticas y publicaciones persistidas. La edición se limita al propio usuario.','SmallN')
screenshot('03-mobile.jpg',max_h=250,max_w=230)
add('Figura 3. Vista responsive del sitio público a 390 px; simulación de viewport móvil.','SmallN')

page('04 / EVIDENCIA REAL','Notificaciones y documentación')
screenshot('04-notifications.jpg',max_h=275)
add('Figura 4. Notificaciones reales generadas por otra sesión: seguimiento, like y comentario. Permanecen disponibles después de reconectar.','SmallN')
screenshot('05-swagger.jpg',max_h=275)
add('Figura 5. Swagger público del backend accesible en /api/docs; el contrato JSON se publica en /api/openapi.json. Las operaciones se generan desde los controladores de NestJS.','SmallN')

page('05 / EVIDENCIA REAL','Chat y archivos persistentes')
screenshot('06-public-chat.jpg',max_h=235)
add('Figura 6. Conversación privada en el despliegue público con emojis, archivo adjunto y estado de lectura. El historial solo se consulta desde las sesiones de sus participantes.','SmallN')
screenshot('07-public-media.jpg',max_h=215)
add('Figura 7. Publicación pública con imagen almacenada en PostgreSQL. Selector de emojis y clip disponibles en publicaciones y chat.','SmallN')
add('Límites y autorización','H2N')
add('PNG, JPG, WebP, PDF y TXT UTF-8; hasta tres archivos de 2 MB por envío. Cuotas de 20 MB por usuario y 100 MB globales. Archivos de publicaciones públicos; archivos de chat privados. Se valida extensión y contenido; PDF/TXT se descargan. No hay cifrado de extremo a extremo ni análisis antivirus.','SmallN')

page('06 / REVISIÓN ACADÉMICA','Cobertura de requisitos')
table([['Criterio / puntos','Implementación y evidencia'],['Frontend / 3','Registro/login, feed, perfiles y diseño responsive. SSR con datos reales y conexión a API desplegada.'],['Backend / 3','REST, validaciones, errores coherentes, usuarios, publicaciones e interacciones. Swagger público.'],['Tiempo real / 2','SSE autenticado: notificaciones, contadores y chat privado. Reconexión y recuperación de historial persistido.'],['Seguridad / 2','scrypt con sal; sesiones revocables; cookie HttpOnly/Secure; CORS/origen; permisos; variables privadas. Adjuntos privados protegidos.'],['Base de datos / 2','PostgreSQL 17, nueve tablas relacionadas y tres migraciones reproducibles. Integridad, índices y transacciones.'],['Despliegue / 3','Dos servicios Docker en Render y PostgreSQL administrado. Frontend, backend y Swagger HTTPS públicos.']],[110,389])
add('Entregables','H2N')
add('Repositorio GitHub con código organizado, README, arquitectura, URLs, .env.example y migraciones. Este PDF incluye nombre, carné, funciones, tecnologías, capturas y enlaces. La entrega en Canvas la realiza el estudiante.')
add('Resultado de la revisión','H2N')
add('La implementación cubre los requisitos técnicos solicitados. La puntuación final corresponde al docente y depende también de la demostración y entrega. Chat y archivos amplían el alcance original, que admitía publicaciones de texto y notificaciones como variante de tiempo real.')
add('Alojamiento para presentación','H2N')
add('Render Free puede suspender servicios por inactividad. La base gratuita caduca el 28 de noviembre de 2026. Se recomienda abrir los enlaces antes de exponer y conservar una copia de los datos si se necesita continuidad.','SmallN')

page('07 / VERIFICACIÓN Y ENTREGA','Resultados y enlaces')
table([['Comprobación','Resultado'],['Integración','26 resultados locales, 9 públicos de funciones base y 8 públicos de chat/multimedia satisfactorios: HTTPS, autenticación, SSR, SSE, interacciones, permisos y validación.'],['Migraciones','Base temporal: esquema inicial, registro previo, evolución conservando el dato y repetición sin duplicados.'],['Persistencia','Reinicio del backend en Render: la misma publicación conserva su identificador y contenido. Ver docs/evidence/public-verification.json y communications-public.json.'],['Interfaz','Sesión y edición de perfil en el navegador público; feed, notificaciones, Swagger y vista responsive.']],[100,399])
add('Repositorio de GitHub','H2N')
repo=escape(links['repository']);add(f'<link href="{repo}" color="#245ce2">{repo}</link>')
add('Acceso local','H2N')
for label,url in [('Frontend','http://localhost:3100'),('Backend','http://localhost:4100/api/health'),('Swagger','http://localhost:4100/api/docs')]:
    add(f'{label}: <link href="{url}" color="#245ce2">{url}</link>','SmallN')
add('Acceso público de producción','H2N')
for key,label in [('frontend','Frontend'),('backend','Backend'),('swagger','Swagger')]:
    url=links.get(key)
    add(f'{label}: '+(f'<link href="{escape(url)}" color="#245ce2">{escape(url)}</link>' if url else 'pendiente de alojamiento.'),'SmallN')
if public:
    add('Plan gratuito de presentación: la base caduca el 28 de noviembre de 2026. Los servicios pueden suspenderse por inactividad y tardar en despertar. Abrir las URLs antes de exponer.','SmallN')
if not public:
    add('Este documento todavía no acredita el criterio de despliegue público. Falta conectar un proveedor, verificar las tres URLs externas y regenerar el PDF antes de entregarlo en Canvas. Las direcciones localhost no son accesibles públicamente.','BodyN')
add('Configuración y reproducción','H2N')
add('El repositorio incluye README, .env.example, tres migraciones, Dockerfiles, compose.yaml, pruebas y render.yaml. La guía docs/DEPLOY.md explica el despliegue y sus variables. No se han incluido secretos ni el carné en el código público.','SmallN')

def decorate(canvas,doc):
    canvas.setTitle('Nexo - Proyecto final de Desarrollo Web')
    canvas.setAuthor(student['name'])
    canvas.setStrokeColor(LINE);canvas.line(48,41,547,41)
    canvas.setFillColor(MUTED);canvas.setFont(font,7)
    canvas.drawString(48,28,'NEXO / DESARROLLO WEB / VALIDACIÓN '+('PÚBLICA' if public else 'LOCAL'))
    canvas.drawRightString(547,28,f'{doc.page}')
doc=SimpleDocTemplate(str(OUT),pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=43,bottomMargin=57)
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
print(OUT)
