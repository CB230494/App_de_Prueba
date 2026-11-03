# Brisa Chat — GitHub Pages + Supabase

App de chat temporal responsive con modo oscuro/claro, salas compartidas por enlace y fotos de una vista.

## REQUISITO IMPORTANTE
GitHub Pages SOLO aloja archivos estáticos. Dos personas en dispositivos distintos NO pueden intercambiar mensajes sin un servidor. Por eso esta versión utiliza Supabase (nivel gratuito sujeto a sus límites), que debe configurarse por tu cuenta. **El ZIP por sí solo NO crea un chat funcional en Internet**.

## PASO 1. Crear Supabase
1. Entrá en https://supabase.com/dashboard y creá un proyecto.
2. Abrí **SQL Editor**, copiá TODO `01_INSTALAR_SUPABASE.sql`, ejecutalo (Run).
3. En **Integrations → Cron**, activá Supabase Cron si está desactivado.
4. En **SQL Editor**, ejecutá `02_ACTIVAR_BORRADO_AUTOMATICO.sql`.
5. Comprobá en Cron → Jobs que aparezca `brisa_borrar_mensajes_caducados`.
6. En **Project Settings → API Keys**, copiá la clave **anon / publishable**. Tomá también la **Project URL**.

## PASO 2. Editar config.js
Reemplazá `https://TU-PROYECTO.supabase.co` por la URL real y `TU_CLAVE_PUBLICABLE_ANON` por la **anon/publishable key** (solo esa; NUNCA la `service_role` o una clave secreta).

## PASO 3. Publicar en GitHub Pages
1. Creá un repositorio GitHub (por ejemplo `brisa-chat`).
2. Subí los archivos de este ZIP al nivel raíz del repositorio, **NO la carpeta externa**.
3. En **Settings → Pages → Build and deployment**, elegí **Deploy from a branch**, `main`, `/ (root)` y guardá.
4. Abrí la URL publicada, escribí tu apodo, entrá a la sala y tocá el botón ↗ para copiar el enlace.
5. Enviá el enlace completo **incluyendo `#sala=`** a otra persona. Ambos deben usar ese mismo enlace para entrar en la MISMA sala.
6. Probalos en dos celulares o ventanas independientes. Para una sala nueva, abrí la página sin `#sala=...`.

## QUÉ HACE
- Textos enviados mediante Supabase y refrescados cada 2,5 segundos (simula tiempo real; no requiere WebSockets).
- Caducidad de exactamente 10 minutos **desde cada envío**, no desde la lectura. El servidor no devuelve mensajes caducados; Cron borra físicamente mensajes vencidos en el siguiente minuto.
- Foto de una sola vista: se reduce/comprime antes de enviarse (máximo ~180 KB de datos) y la **primera solicitud de apertura** obtiene la imagen y la elimina de la base de datos mediante una operación atómica. El navegador que abrió la foto la conserva en memoria mientras está abierta. Al cerrarla, desaparece de la interfaz.
- No es necesario registrar usuarios ni utilizar una contraseña.
- Modo claro y oscuro guardado en el navegador.

## LIMITACIONES Y PRIVACIDAD — LEER
- **No es WhatsApp**: no ofrece cifrado de extremo a extremo, cuentas verificadas, notificaciones push ni garantías contra capturas de pantalla, grabación, extensiones o software malicioso.
- El URL de la sala es una **llave de acceso**. Quien lo recibe puede leer sus mensajes mientras estén vigentes. No lo publiques en redes sociales.
- Los nombres son apodos elegidos por cada persona: se pueden repetir o suplantar.
- Las fotos pueden quedar temporalmente en memoria/caché del navegador o en sistemas técnicos del proveedor; “una vista” es un control de la aplicación, no una protección contra copias o capturas.
- Los textos y fotos se almacenan temporalmente en Supabase; la eliminación física requiere configurar Cron y que esté funcionando. No garantiza eliminación de copias de respaldo, logs o capturas externas.
- No envíes información médica, financiera, policial, legal confidencial ni otros datos sensibles.
- Este prototipo público sin autenticación está diseñado para pruebas privadas con pocas personas. Tiene un límite simple de mensajes por sala, pero **no** protección avanzada contra abuso, spam o consumo de recursos del proyecto. Para usarlo públicamente, agregá autenticación, moderación y protección contra bots.
- La aplicación necesita conexión de Internet, Supabase activo y el CDN de supabase-js accesible.

## VERIFICACIONES SUGERIDAS
- Dos dispositivos, misma URL: uno envía texto y el otro lo lee.
- Foto: el receptor abre una vez; al intentar de nuevo aparece consumida.
- A los 10 minutos el mensaje desaparece en ambos dispositivos, incluso si Cron no funcionara; en ese caso no habría garantía de borrado físico.
- Tema oscuro/claro y pantalla móvil.

## Archivos
- `index.html`: interfaz
- `styles.css`: diseño responsivo
- `app.js`: lógica del chat
- `config.js`: URL y clave pública de Supabase
- `01_INSTALAR_SUPABASE.sql`: tabla y operaciones seguras de chat
- `02_ACTIVAR_BORRADO_AUTOMATICO.sql`: trabajo programado de limpieza
- `favicon.svg`: ícono
