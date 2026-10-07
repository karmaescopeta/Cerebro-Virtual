# Proposal: infra-repo-workflow

## Why

El flujo de trabajo actual no tiene separación dev/producción ni backup externo: todo se edita directo en el repo local y en `main`. Cada cambio de infraestructura (skills, CI, workflows) vive solo en el disco y en la memoria del agente, sin repositorio central que lo respalde y sin rama `dev` donde experimentar antes de pasar a producción.

## What Changes

- **Repo GitHub privado `cerebro-virtual-dev`** como mirror/backup del repo actual. NO incluye la bóveda, ni ningún secreto, ni `sistema-agente/`, ni `instances/`.
- **Rama `dev`** — todo el trabajo se edita en `dev`. Una vez aprobado (visto bueno manual del usuario), se crea PR `dev → main` y merge manual. Producción = `main`.
- **`.gitignore` revisado** — excluye: bóveda, datos de usuario, `sistema-agente/`, `instances/`, y cualquier fichero con credenciales o tokens.
- **Un único repo**: `C:\proyectoBueno\cerebro virtual`. No se crean repos separados para skills/CI/planes.

## Impact

- Affected specs: infraestructura de repo (backup + branching + seguridad).
- Affected code: `.gitignore`, remoto git, rama `dev`.
- Riesgo: publicación accidental de datos privados → mitigado por `.gitignore` explícito y revisión previa al primer push.
- Dependencia puntual: `gh auth login` (device-flow) caduca ~15 min tras iniciar; se re-ejecuta si el código caduca.
