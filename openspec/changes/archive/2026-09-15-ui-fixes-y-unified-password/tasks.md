# Tasks: ui-fixes-y-unified-password

## 1. Password unificada (backend)
- [x] 1.1 Helper `_omni_password()` (env → fallback /app/.env) + reemplazar 3 os.getenv (~3319, ~3409, ~3522) — patch, NO write_file (main.py 3600+ líneas)
- [x] 1.2 `/api/init/configure`: si `dashboardPassword` → `_update_env_token("OMNIROUTE_MANAGE_PASSWORD", pwd)` + recreate omniroute (`run_in_threadpool`, dual-bind) + login verificación (warning no bloqueante)
- [x] 1.3 `PUT /api/agent/config`: aceptar `dashboardUser`/`dashboardPassword` opcionales → guarda en agent-config + mismo flujo 1.2 (Hermes: recreate sistema-agente; OmniRoute: recreate omniroute)
- [x] 1.4 PONYTEAIL: probar las 3 rutas afectadas con curl tras rebuild

## 2. Wizard + Ajustes (frontend)
- [x] 2.1 Wizard: texto en Step1 "Esta contraseña será la del panel de Hermes y de OmniRoute" + añadir `dashboardUser`/`dashboardPassword` al payload si flujo lo necesita (ya van en configure)
- [x] 2.2 Ajustes: sección "Acceso" (user + password nuevos, botón Guardar → PUT /api/agent/config) + nota "La misma contraseña abre el panel de Hermes (:8080) y OmniRoute (:20128)"
- [x] 2.3 ModelosView: link OmniRoute → `http://${location.hostname}:20128` (mismo patrón que botón Dashboard de IA Local)

## 3. nginx
- [x] 3.1 Borrar location `/omniroute/` de frontend/nginx.conf (muerto: redirects absolutos + colisión /api)

## 4. UI chrome (header/sidebar)
- [x] 4.1 Header.jsx: borrar badge SYSTEM HEALTHY; CSS `.header-badge`/`pulse-dot` fuera
- [x] 4.2 Sidebar.jsx: borrar botón LOGOUT; versión desde prop (App: fetch `/api/version` → `{current, githubRepo}`); si unknown ocultar
- [x] 4.3 Header: título "Cerebro Virtual" → link `https://github.com/${githubRepo}` si repo conocido

## 5. Responsive + fullscreen PC
- [x] 5.1 Localizar scrollbar horizontal con devtools (no a ciegas) y fixar root cause
- [x] 5.2 Media query 768px: header compacto, notif-dropdown ancho viewport, chat burbujas 100%, botones toggle wrap, wizard inputs 100%
- [x] 5.3 Grafo: scroll interno solo en canvas del grafo, página sin scroll-x
- [x] 5.4 Verificar en navegador: DevTools mobile (375px, 768px) + PC sin scroll-x

## 6. Verificación e2e (estándar del usuario)
- [x] 6.1 Rebuild backend/frontend + recreate (pitfall: código baked en imagen)
- [x] 6.2 esbuild check de los .jsx tocados
- [x] 6.3 Flujo completo: reset config → wizard con credenciales → login Hermes :8080 con la MISMA contraseña → login OmniRoute :20128 → link Modelos abre panel
- [x] 6.4 Cambio de contraseña en Ajustes → old 401 / new 200 en ambos paneles
- [x] 6.5 UI final en navegador (PC + móvil emulado), versión real visible, sin SYSTEM HEALTHY, sin LOGOUT

## 7. Notas de verificación (2026-09-15)
- e2e real: configure completo via API → passwordStatus=omniroute-ok, provision=True
- login OmniRoute :20128 en navegador OK con pw unificada
- login Hermes :8080 → 200 pw correcta / 401 incorrecta (requiere restart de sistema-agente para regenerar hash: el config.yaml se genera solo al arrancar)
- móvil 375px: 0 overflow en todas las tabs (grafo: pan/zoom interno por diseño)
- PC: sin scroll-x tras quitar width:100vw de .app-main
