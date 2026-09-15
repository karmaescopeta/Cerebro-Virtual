# Cambio 1 — OmniRoute provisionado por backend (sin dashboard)

## Flujo
1. `.env`: `OMNIROUTE_MANAGE_PASSWORD` (password gestión OmniRoute). Compose pasa `INITIAL_PASSWORD` + `OPENROUTER_API_KEY` al contenedor omniroute.
2. OmniRoute hace bootstrap del password en primer arranque (`ensurePersistentManagementPasswordHash`).
3. Backend endpoint `/api/localai/provision`:
   - login `POST /api/auth/login` {password} → cookie `auth_token` (JWT 30d)
   - `GET /api/providers` → si no existe conexión openrouter: `POST /api/providers` {provider:'openrouter', apiKey: OPENROUTER_API_KEY del .env}
   - si no existe `ollama-local`: `POST /api/providers` {provider:'ollama-local', providerSpecificData:{baseUrl:'http://ollama:11434/v1'}}
   - devuelve estado de conexiones.
4. Frontend: botón "Configurar proveedores" en sección IA Local llama al endpoint. Status muestra conexiones activas.

## Esquema provider_connections (referencia)
id, provider, name, priority, is_active, api_key, provider_specific_data (JSON: baseUrl para local), created_at, updated_at.

## Notas
- ollama-local: api key opcional (isLocalProvider → optional). baseUrl via providerSpecificData.
- combos (apartado 3 del usuario): tabla `combos` (id, name, data JSON, sort_order) — enrutamiento multi-modelo con nombre. Se deja para fase posterior.
