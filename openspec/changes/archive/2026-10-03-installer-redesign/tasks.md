# Tasks — installer-redesign

## 1. app.py (patch)
- [x] 1.1 `CREATE_NO_WINDOW` en TODOS los subprocess (run(), instance_start, instance_remove) — getattr seguro
- [x] 1.2 instance_start → thread con Popen + buffer de log {lines, done, ok}; buffer cap ~200 líneas
- [x] 1.3 Endpoint `GET /api/logs/<name>` (polling)
- [x] 1.4 Endpoint `GET /api/download/<name>` (zip del vault → Content-Disposition)

## 2. index.html (patch)
- [x] 2.1 Tokens :root = los de la web + Material Symbols Rounded (fuente Outlined fuera)
- [x] 2.2 Botón Abrir (running → window.open frontend port) + botón Descargar vault
- [x] 2.3 Modal borrado con confirmación tecleada (deshabilitado hasta match exacto)
- [x] 2.4 Panel de log con polling 1.5s durante inicio + auto-scroll
- [x] 2.5 Auto-refresh 5s con guard (no pisar modal/log abierto)
- [x] 2.6 Copy ES una voz (header, requisitos, vacío, modales, toasts)

## 3. Verificación
- [x] 3.1 pyinstaller build OK (build.bat) — exe sin errores
- [x] 3.2 Ejecutar exe real: crear instancia de test → CERO ventanas CMD visibles durante requisitos/create/start
- [x] 3.3 Iniciar instancia: log en vivo muestra líneas reales; fin marca ok/error; Abrir abre el frontend
- [x] 3.4 Descargar vault: zip descargado con contenido correcto (comparar archivos)
- [x] 3.5 Borrado: nombre incorrecto = botón deshabilitado; correcto = borra
- [x] 3.6 Auto-refresh refleja estado externo (docker stop desde terminal)
- [x] 3.7 Requisitos con Docker parado → badge Faltante + link Descargar
- [x] 3.8 Sección Hecho en design-plans/ + usuario aprueba
