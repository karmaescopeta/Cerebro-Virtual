## ADDED Requirements

### Requirement: Cloudflare Tunnel service in compose
The system SHALL include a `cloudflared` service in docker-compose.yml. The service SHALL start only when `CLOUDFLARE_TUNNEL_TOKEN` is set in `.env`. When no token is present, the service SHALL remain in a dormant state (exit 0 or sleep infinity).

#### Scenario: Token present
- GIVEN a `.env` with `CLOUDFLARE_TUNNEL_TOKEN` set
- WHEN the user runs `docker compose up -d`
- THEN the cloudflared container starts and connects to Cloudflare's edge
- AND the tunnel routes traffic to the frontend service
- AND the cerebro is accessible via the assigned subdomain

#### Scenario: No token
- GIVEN a `.env` without `CLOUDFLARE_TUNNEL_TOKEN`
- WHEN the user runs `docker compose up -d`
- THEN the cloudflared container starts but immediately exits with code 0
- AND no tunnel is established
- AND the cerebro is only accessible on the LAN via configured ports

### Requirement: Wizard collects tunnel token
The wizard SHALL include a step after the OpenRouter API key that asks for an optional `CLOUDFLARE_TUNNEL_TOKEN`. If the user does not have a Cloudflare account, the wizard SHALL display a link to `https://www.cloudflare.com` to create one.

#### Scenario: User has token
- GIVEN the wizard is running and the user has a Cloudflare tunnel token
- WHEN the wizard reaches the Cloudflare step (after API key)
- THEN the user pastes the token
- AND the backend saves it in `agent-config.json`
- AND the backend writes it to `.env` on the host so compose picks it up

#### Scenario: User skips token
- GIVEN the wizard is running and the user does not have a token
- WHEN the user clicks "Skip" on the Cloudflare step
- THEN no token is saved
- AND the cerebro works locally only
- AND the user can add the token later by editing `.env` and running `docker compose up -d`

### Requirement: Nginx proxies agent path
The frontend nginx SHALL proxy requests to `/agent` → `http://sistema-agente:8080` so the Hermes dashboard is accessible via a path prefix both locally and through the Cloudflare tunnel.

#### Scenario: Access Hermes panel via tunnel
- GIVEN a cerebro instance with an active Cloudflare tunnel at `cerebro-app1.tudominio.com`
- WHEN the user navigates to `cerebro-app1.tudominio.com/agent`
- THEN nginx proxies the request to `sistema-agente:8080`
- AND the Hermes dashboard loads

#### Scenario: Access Hermes panel locally
- GIVEN a cerebro instance running on the LAN
- WHEN the user navigates to `localhost:5173/agent`
- THEN nginx proxies the request to `sistema-agente:8080`
- AND the Hermes dashboard loads

### Requirement: One tunnel per cerebro instance
Each cerebro instance SHALL have its own `CLOUDFLARE_TUNNEL_TOKEN` in its own `.env`. Multiple instances on the same host SHALL each connect to their own tunnel, routing to their own subdomain.

#### Scenario: Two instances with tunnels
- GIVEN two cerebro instances: `cerebro-app1` with token A and `cerebro-app2` with token B
- WHEN both instances are running
- THEN `cerebro-app1` is accessible at its subdomain and `cerebro-app2` at its own
- AND traffic to one instance does not reach the other

### Requirement: Tunnel toggle in Ajustes
The system SHALL provide a toggle in the Ajustes view that shows the Cloudflare Tunnel status. If no tunnel is configured, a button "Iniciar Tunel" SHALL allow the user to configure it post-install. If a tunnel is already active, the status SHALL show "Túnel Activo" instead of the button.

#### Scenario: No tunnel configured — user activates from Ajustes
- GIVEN a running cerebro instance without a Cloudflare tunnel
- WHEN the user clicks "Iniciar Tunel" in Ajustes
- THEN a form appears asking for the `CLOUDFLARE_TUNNEL_TOKEN`
- AND the user can paste the token and save
- AND the backend writes the token to `agent-config.json` and `.env`
- AND the backend runs `docker compose -p $PROJECT --profile tunnel up -d cloudflared`
- AND the tunnel becomes active

#### Scenario: Tunnel already configured
- GIVEN a running cerebro instance with an active Cloudflare tunnel
- WHEN the user opens Ajustes
- THEN the tunnel section shows "Túnel Activo" with a green indicator
- AND no "Iniciar Tunel" button is shown
- AND a "Desactivar" option exists to stop the tunnel

#### Scenario: User configured tunnel in wizard, visits Ajustes
- GIVEN a cerebro instance where the tunnel was configured during the wizard
- WHEN the user opens Ajustes
- THEN the tunnel section shows "Túnel Activo"
- AND no button to start is shown

### Requirement: Access control via Cloudflare Zero Trust
The system SHALL NOT implement local authentication for remote access. Access control for remote (tunnel) access SHALL be managed entirely through Cloudflare Zero Trust policies in the Cloudflare dashboard.

#### Scenario: Admin restricts access
- GIVEN a cerebro instance with tunnel at `cerebro-app1.tudominio.com`
- WHEN the admin configures a Zero Trust policy allowing only `user@example.com`
- THEN only that user can access the subdomain
- AND no other users can reach the cerebro
- AND no authentication code exists in the cerebro application
