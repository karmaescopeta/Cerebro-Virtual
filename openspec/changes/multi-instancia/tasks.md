# Tasks: Multi-instancia Cerebro Virtual

## Fase 1: docker-compose.yml + migración

- [ ] 1.1 Parameterizar vault y .env en docker-compose.yml (`${VAULT_DIR:-./vault}`, `${ENV_FILE:-./.env}`)
- [ ] 1.2 Crear `instances/default/` y mover `vault/` + `.env` ahí
- [ ] 1.3 Actualizar `VAULT_HOST_PATH` en `instances/default/.env` al nuevo path absoluto
- [ ] 1.4 Simplificar `start.bat` → wrapper de `cerebro-manage start default`
- [ ] 1.5 Verificar instancia `default` levanta correctamente tras migración

## Fase 2: cerebro-manage.bat

- [ ] 2.1 Crear `cerebro-manage.bat` con estructura base
  - Sin argumentos: modo interactivo (cuenta instancias, pregunta si crear otra)
  - Con argumentos: `create <nombre>`, `start <nombre>`, `stop <nombre>`, `list`, `remove <nombre>`, `ports <nombre>`
- [ ] 2.2 Implementar `create <nombre>`: crear dir, copiar .env base, auto-asignar puertos, crear vault vacío
- [ ] 2.3 Implementar auto-asignación de puertos (escanear .env instances + docker ps)
- [ ] 2.4 Implementar `start <nombre>`: `docker compose -p <nombre> --env-file ... up -d --build [--profile tunnel]`
- [ ] 2.5 Implementar `stop <nombre>`: `docker compose -p <nombre> stop`
- [ ] 2.6 Implementar `list`: tabla con nombre, puertos, estado
- [ ] 2.7 Implementar `remove <nombre>`: stop + down + confirmación + borrar dir
- [ ] 2.8 Implementar `ports <nombre>`: mostrar puertos asignados
- [ ] 2.9 Verificar create + start + stop + remove con segunda instancia

## Fase 3: Backend — endpoint de rutas

- [ ] 3.1 Implementar `GET /api/instances/routes` en `backend/app/main.py`
  - Leer `docker-compose.yml` montado en `/app/docker-compose.yml:ro`
  - Parsear servicios, puertos internos, puertos host del `.env`
  - Leer etiquetas de `.env` (`ROUTE_LABEL_*`)
  - Devolver JSON con servicios + URLs + etiquetas
- [ ] 3.2 Implementar `PUT /api/instances/routes/labels` para guardar etiqueta
  - Escribir `ROUTE_LABEL_<SERVICE>=<valor>` en `/app/.env`
  - Sin rename atomic (write_text directo — pitfall P2)
- [ ] 3.3 Verificar endpoints con curl

## Fase 4: Frontend — Tab Rutas

- [ ] 4.1 Localizar archivo del tab "Modelos" en `frontend/src/`
- [ ] 4.2 Añadir sección "Rutas" al final del tab
  - Tabla: Etiqueta (editable), Servicio, URL Interna, botón Copiar
  - Fetch a `GET /api/instances/routes` al montar
- [ ] 4.3 Implementar botón Copiar (clipboard API)
- [ ] 4.4 Implementar edición de etiqueta (inline edit + save → `PUT /api/instances/routes/labels`)
- [ ] 4.5 Fallback: etiqueta vacía → mostrar nombre del servicio
- [ ] 4.6 Build frontend + verificar en navegador

## Fase 5: Verificación end-to-end

- [ ] 5.1 Instancia `default` funciona tras todos los cambios
- [ ] 5.2 Crear segunda instancia `cerebro2`, levantar, verificar aislamiento de red
- [ ] 5.3 Tab Rutas muestra servicios correctos en ambas instancias
- [ ] 5.4 Editar etiqueta, recargar, verificar persistencia
- [ ] 5.5 Copiar URL, pegar en Cloudflare dashboard, verificar funciona
- [ ] 5.6 Parar `cerebro2`, verificar `default` sigue funcionando
- [ ] 5.7 `start.bat` levanta `default` correctamente
