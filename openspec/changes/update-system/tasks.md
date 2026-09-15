## Tasks

### Backend
- [ ] 1. Helper `_get_github_latest(repo)` — GET releases/latest, return tag_name. Timeout 10s. On error return None.
- [ ] 2. Helper `_get_hermes_version()` — `docker exec <container> hermes --version`, parse output. Timeout 5s.
- [ ] 3. Endpoint `GET /api/updates/check` — compara VERSION local vs GitHub Cerebro + Hermes instalado vs GitHub Hermes. Return `{"cerebro": {current, latest, update}, "hermes": {current, latest, update}}`.
- [ ] 4. Endpoint `POST /api/updates/cerebro` — `git pull` (con stash si dirty) + rebuild backend+frontend + force-recreate.
- [ ] 5. Endpoint `POST /api/updates/hermes` — tag backup + rebuild no-cache + recreate + post-checks (running, :8080 responde, patch needle).
- [ ] 6. Endpoint `POST /api/updates/rollback/hermes` — tag backup→latest + recreate. Error si no backup.
- [ ] 7. Helper `_post_check_hermes()` — 3 checks con timeout 60s total.

### Frontend
- [ ] 8. `App.jsx` — fetch `/api/updates/check` al cargar, pasar `updates` al Header.
- [ ] 9. `Header.jsx` — icono campana + badge rojo si hay updates. Click → toggle dropdown.
- [ ] 10. `NotificationDropdown.jsx` — panel desplegable lateral izquierdo, 2 secciones (Cerebro, Hermes), versión current→latest, botón Actualizar.
- [ ] 11. Estados: updating (spinner+disabled), error+rollback button.
- [ ] 12. CSS para dropdown + badge.

### Verificación
- [ ] 13. Test: `/api/updates/check` responde con versions correctas.
- [ ] 14. Test: rollback funciona (tag backup → recreate).
- [ ] 15. Test: post-check detecta contenedor caído.
