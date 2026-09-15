# Tasks: update-system-v2

## 1. Backend (main.py, sección updates)
- [x] 1.1 `_IMAGE_COMPONENTS` dict: omniroute, ollama, searxng, cloudflared → {image, repo, svc, check_url}
- [x] 1.2 `_docker_local_digest(img)` + `_docker_remote_digest(img)` via `docker manifest inspect`
- [x] 1.3 `_smoke_service(svc, check_url)`: container running + GET interno responde
- [x] 1.4 `GET /api/updates/check` extendido: lista `components` (6) + keys cerebro/hermes legacy para campana
- [x] 1.5 `POST /api/updates/apply/{component_id}`: git → flow v1 + smoke completo; imagen → tag backup, compose pull, up --force-recreate, smoke, rollback auto si falla
- [x] 1.6 `GITHUB_TOKEN` opcional en .env → header en `_github_latest`

## 2. Frontend
- [x] 2.1 `ActualizacionesView.jsx`: cards por componente, current→latest, resumen (line-clamp), botón "Más info" (GitHub), botón Actualizar, aviso rollback
- [x] 2.2 App.jsx: tab `updates`, import view
- [x] 2.3 Sidebar + MobileNav: item ACTUALIZACIONES (icon update) antes de AJUSTES

## 3. Verificación
- [x] 3.1 Rebuild backend + frontend (compose build + up force-recreate)
- [x] 3.2 `curl /api/updates/check` → 6 componentes con campos correctos
- [x] 3.3 Smoke-test syntax JSX (esbuild) + endpoints apply existentes intactos
