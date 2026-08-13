# Spec: Cerebro Virtual

## ADDED Requirements

### Requisito: Estructura del Vault
El sistema DEBE mantener un vault con tres directorios principales: `raw/` (entrada inmutable), `wiki/` (conocimiento procesado), y `outputs/` (informes generados).

#### Escenario: Inicialización de vault nuevo
- DADA una instalación nueva sin vault
- CUANDO el sistema arranca por primera vez
- ENTONCES se crean los directorios `raw/`, `raw/.processed/`, `wiki/`, `outputs/`, y `system/`

#### Escenario: Subida de archivo
- DADO un usuario subiendo un archivo via drag-and-drop del chat
- CUANDO el backend recibe el archivo
- ENTONCES el archivo se guarda en `raw/chat/<filename>` y es visible inmediatamente en el host

### Requisito: Soporte Multi-Modelo
El sistema DEBE soportar tres modos de modelo: `openrouter` (nube), `local` (Ollama), y `mixed` (ambos).

#### Escenario: Configuración en modo mixto
- DADO un usuario seleccionando "Mixto" en el wizard
- CUANDO el usuario proporciona API key y specs de hardware
- ENTONCES el sistema guarda `modelMode: "mixed"` con configs de OpenRouter y Ollama

#### Escenario: Toggle entre modos
- DADO un agente configurado en modo mixto
- CUANDO el usuario cambia a modo local en ajustes
- ENTONCES el sistema actualiza `agent-config.json` y reinicia el agente

### Requisito: Delegación de Tareas Kanban
El Coordinador DEBE crear tareas Kanban solo cuando se necesite delegación, no para respuestas simples.

#### Escenario: Archivo llega al chat
- DADO un usuario sube un archivo y envía un mensaje
- CUANDO el Coordinador recibe el mensaje
- ENTONCES se crea una tarea Kanban asignada al Sintetizador

#### Escenario: Pregunta simple
- DADO un usuario pregunta "¿Cuánto es 2+2?"
- CUANDO el Coordinador evalúa la pregunta
- ENTONCES no se crea tarea Kanban y el Coordinador responde directamente

### Requisito: Instalación de IA Local
El sistema DEBE bloquear la UI durante la instalación de modelos locales hasta que estén listos.

#### Escenario: Instalar modelos locales
- DADO un usuario pulsa "Instalar IA Local" en ajustes
- CUANDO comienza la instalación de modelos
- ENTONCES un overlay a pantalla completa bloquea toda interacción y muestra progreso en tiempo real
- Y cuando la instalación completa, el agente se reinicia automáticamente
