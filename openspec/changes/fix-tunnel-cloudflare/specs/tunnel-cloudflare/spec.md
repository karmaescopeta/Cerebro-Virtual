## ADDED Requirements

### Requirement: Aceptar comando completo de Cloudflare
El sistema SHALL aceptar tanto el comando completo de Cloudflare (`docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJ...`) como el token puro (`eyJ...`). El backend SHALL extraer el valor del flag `--token` si el input lo contiene.

#### Scenario: Usuario pega comando completo
- **WHEN** el usuario pega `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoi...`
- **THEN** el backend extrae `eyJhIjoi...` y lo guarda como token

#### Scenario: Usuario pega token puro
- **WHEN** el usuario pega `eyJhIjoi...`
- **THEN** el backend lo guarda directamente como token

#### Scenario: Input sin token
- **WHEN** el input no contiene `--token` ni un string con formato `eyJ`
- **THEN** el backend rechaza con error 400

### Requirement: Activar túnel con reinicio inmediato
Al configurar el token, el backend SHALL escribirlo en `.env` (CLOUDFLARE_TUNNEL_TOKEN) y ejecutar `docker compose --profile tunnel up -d cloudflared`. El frontend SHALL mostrar un overlay de carga hasta recibir confirmación del backend.

#### Scenario: Activación exitosa
- **WHEN** el usuario envía un token válido
- **THEN** el backend lo escribe en `.env`, levanta cloudflared, y responde `{success: true}`
- **AND** el frontend muestra overlay de carga hasta recibir la respuesta

#### Scenario: cloudflared no arranca
- **WHEN** el token se guarda pero `docker compose up` falla
- **THEN** el backend responde `{success: false, message: ...}` con el error de compose
- **AND** el frontend muestra el error y quita el overlay

### Requirement: Desactivar túnel con reinicio inmediato
Al desactivar, el backend SHALL ejecutar `docker compose stop cloudflared`, borrar el token de `.env` (CLOUDFLARE_TUNNEL_TOKEN=) y de `agent-config.json`.

#### Scenario: Desactivación exitosa
- **WHEN** el usuario click "Desactivar"
- **THEN** el backend para cloudflared, borra el token, responde `{success: true}`
- **AND** el frontend muestra overlay de carga hasta recibir la respuesta

### Requirement: Estado real del túnel
`GET /api/tunnel/status` SHALL verificar si el container cloudflared está corriendo, no solo si hay token guardado.

#### Scenario: Túnel corriendo
- **WHEN** cloudflared está running
- **THEN** responde `{active: true, hasToken: true}`

#### Scenario: Token guardado pero container parado
- **WHEN** hay token en `.env` pero cloudflared no está corriendo
- **THEN** responde `{active: false, hasToken: true}`

#### Scenario: Sin token
- **WHEN** no hay token configurado
- **THEN** responde `{active: false, hasToken: false}`

### Requirement: Labels y placeholders claros
Los campos de entrada en WizardStep1 y AjustesView SHALL indicar que se pega el comando completo de Cloudflare, no solo un token.

#### Scenario: Usuario ve el campo en el wizard
- **WHEN** el usuario abre el wizard Step 1
- **THEN** el label dice "Cloudflare Tunnel (opcional)" y el placeholder dice "Pega aquí el comando de Cloudflare..."
- **AND** el helper text explica que se pega el comando completo de la página de Cloudflare

#### Scenario: Usuario ve el campo en Ajustes
- **WHEN** el usuario abre la sección "Acceso Remoto" en Ajustes
- **THEN** el placeholder dice "Pega aquí el comando de Cloudflare..."
- **AND** el helper text explica lo mismo