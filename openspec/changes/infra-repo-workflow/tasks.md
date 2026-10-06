# Tasks: infra-repo-workflow

## 1. Autenticación y remoto

- [x] 1.1 Configurar remoto GitHub privado `cerebro-virtual-dev` apuntando al repo actual (`gh auth login` device-flow; si el código A9FF-83D0 caducó, re-ejecutar con código nuevo)
- [x] 1.2 Crear el repo privado `cerebro-virtual-dev` en GitHub

## 2. Frontera de seguridad

- [x] 2.1 Revisar y actualizar `.gitignore` — excluir: bóveda, datos de usuario, `sistema-agente/`, `instances/`, ficheros con credenciales/tokens
- [x] 2.2 Verificar con `git status` / `git ls-files` que ninguno de los ficheros a publicar pertenece a las categorías excluidas

## 3. Rama dev

- [x] 3.1 Crear rama `dev` desde `main` y configurarla como rama de trabajo por defecto
- [x] 3.2 Primer push del historial local a `cerebro-virtual-dev` (desde `dev`)
- [x] 3.3 Push de `main` al remoto para tener producción sincronizada

## 4. Flujo dev → main

- [x] 4.1 Confirmar que el trabajo posterior se commitea/pushea a `dev` y NO directo a `main`
- [x] 4.2 Definir el ritual de salida a producción: visto bueno del usuario → PR `dev → main` → merge manual
