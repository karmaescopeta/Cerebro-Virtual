# Proposal: gestor-usabilidad

## Por qué

Auditoría completa del Gestor de Cerebros v1.4.1 (2026-10-06, ver `design-plans/auditoria-gestor-2026-10-06.md`): análisis de código + E2E simulando el binario standalone con descarga real y errores de usuario inyectados en cada punto. El gestor es el puente del producto hacia el público no técnico (segmento B: profesionales con datos regulados — el que paga). Criterio rector: **fácil, sencillo, intuitivo**.

Resultado: 5 crashes confirmados en vivo, 16 problemas de usabilidad y 5 de robustez — ninguno bloqueante del flujo feliz (que funciona y está verificado), pero todos rompen la promesa "sin terminal, sin sorpresas" en el momento en que el usuario se desvía un paso.

## Qué cambia

**Fase 1 — Crashes (C1-C5, lo primero porque nada es intuitivo si explota):**
- C1: límite de longitud del nombre (64) + try/except en `instance_create` → error JSON siempre.
- C2/C3: `instance_stop`/`instance_remove` capturan `TimeoutExpired` y suben timeout a 300s → error JSON legible ("cerebro grande, está tardando") en vez de conexión rota.
- C4: pseudo-nombres de tareas con prefijo (`task:setup`, `task:deps`…) en `START_LOGS`/`/api/logs` → nombres de cerebro `setup`/`deps`/`move`/`dockermove`/`relocate` dejan de pisar paneles del gestor. Frontend pide `/api/logs/task:setup` para sus paneles.
- C5: `instance_remove` marca el log del cerebro como terminado (mata al worker fantasma) + aviso en el modal si el cerebro está encendido/arrancándose.

**Fase 2 — Primer contacto (U1, U4, U6):**
- U1: "Imágenes base" sale del contador de "Faltan N" (es informativo: se descargan solas) → chip "Todo listo" en instalación limpia.
- U4: botón "Nuevo cerebro" disabled → estado visible con el paso que falta (no solo title en hover).
- U6: modal dual instalar/recuperar → pregunta inicial "¿Ya lo tienes instalado?" con dos caminos titulados (instalar vs señalar existente).

**Fase 3 — Botones y vocabulario (U5, U13):**
- U5: "Abrir carpeta existente" y "Mover todo a otra carpeta" salen de la fila del h2 → sección propia "Sistema" con los dos botones grandes y sus explicaciones (el ⓘ se elimina).
- U13: glosario fijo en todos los textos: **el sistema** (una instalación) / **tus cerebros** (instancias). Un solo verbo por acción.

**Fase 4 — Feedback y validación (U17, U3, U2, U12, U8, U10, U11):**
- U17 (reportado por el usuario): el primer arranque parece muerto — sin barras ni logs. Fix: `--progress=plain` en el `up` (pasos de build visibles; verificado que buildkit los oculta sin TTY), contador de tiempo transcurrido con tick 1s y última línea de actividad siempre visible en el panel, traducción de "Downloading X" → "Descargando X".
- U3: validación del nombre en vivo en el modal (deshabilita Crear + motivo bajo el input), incluida la longitud.
- U2: confirmación de borrado case-insensitive + hint si no coincide.
- U12: "Ya existe" explica qué hacer.
- U8: toasts de error 8s o hasta clic, sin apilar; `role=alert`.
- U10: panel de arranque termina en "✓ Iniciado" + botón Abrir (no desaparece).
- U11: botón Iniciar se deshabilita al pulsarlo (sin doble POST posible).

**Fase 5 — Pulido (U7, U9, U15, U16, M1-M5):**
- U7: tabla → columna "Acceso" clicable; puertos y 0.0GB fuera de la vista principal.
- U9: "Nueva carpeta" input inline con validación de caracteres Windows (fuera prompt()).
- U15: README "Si algo falla" reescrito al flujo del gestor; nota "para técnicos" aparte; botón "Arrancar Docker" en requisitos cuando el motor no corre.
- U18 (reportado por el usuario): README añade la virtualización como requisito paso 0 — cómo comprobarla (Administrador de tareas) y activarla (BIOS: Intel VT-x / AMD SVM; "Plataforma de máquina virtual" + `wsl --install`).
- U16: líneas clave del primer arranque interpretadas en español ("Descargando piezas del sistema (~3GB)…") sobre el log crudo colapsable.
- M1-M5: edge de doble instalación, cachear stats 2-3s, enlaces de descarga uno a uno, mensajes de timeout del selector nativo.

## Fuera de alcance
- Rediseño visual global del gestor (tokens ya correctos).
- Wizard/configuración interna del stack (ese ya tiene su propio ciclo).
- Responsive completo del gestor (U14 queda documentado como pendiente de decisión — ventana estrecha es caso raro para un gestor de PC; solo se pilla lo gratis de las cards si la tabla se toca).
- Cambios en el exe/CI más allá de recompilar (`GESTOR_VERSION` → 1.5.0).

## Verificación
Cada fase se prueba con el mismo arnés de la auditoría (server en proceso + exe simulado + docker mockeado + asserts DOM/API): los tests de hoy se convierten en checks re-ejecutables. El flujo feliz README (descarga real → crear → iniciar → borrar) se re-verifica íntegro tras cada fase. Exe final: `py -m PyInstaller …` + verificación visual del usuario (ley del skill: la IA no ve el escritorio).
