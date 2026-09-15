# Proposal: Cloudflare Access — login Google delante del túnel

## Why
Cualquiera con la URL del tunnel entra sin autenticarse. Cloudflare Zero Trust (plan Free, hasta 50 usuarios) permite poner login Google delante de todo el tunnel sin tocar código.

## What Changes
- Configuración en Cloudflare Zero Trust dashboard (no código):
  1. Zero Trust → Access → Applications → Add → Self-hosted.
  2. Dominio: el dominio del tunnel (ej. `cerebro.midominio.com`) o wildcard `*.midominio.com` para cubrir todas las páginas del tunnel.
  3. Identity provider: Google (login con cuenta Google, One Time PIN por email como alternativa).
  4. Policy: Allow / Include / Emails → la cuenta Google del usuario.
- Resultado: al abrir cualquier URL del tunnel → pantalla de login Google → solo el email autorizado pasa.
- En .env del host se documenta (no token, solo recordatorio): nada sensible nuevo.
- Documentado en skill `cerebro-virtual` references/tunnel-cloudflare-fix.md una vez configurado y verificado.

## Impact
- Affected: solo config Cloudflare (dashboard), verificación desde fuera del tunnel. Cero código.
- Risks: si el email de Google no coincide exacto, queda fuera (fácil de arreglar en policy). Cloudflared no necesita restart.
- Rollback: borrar la Access Application.

## Nota
El dashboard de OmniRoute también queda protegido si se publica vía tunnel con Access delante (recomendado: NO exponer dashboard OmniRoute, solo red interna).
