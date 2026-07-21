# Cerebro Virtual — Spec de UX para Google Stitch

> Este documento describe todas las pantallas, botones, estados y flujos de usuario de la aplicación Cerebro Virtual. Está pensado para que un diseñador IA (Google Stitch) pueda generar el diseño visual completo.

---

## 1. Tema visual general

- **Estilo**: Dark mode, minimalista, estilo "developer dashboard" tipo Linear / Vercel / Notion dark.
- **Paleta de colores** (actual, mejorable):
  - Fondo principal: `#0a0a0a` (casi negro)
  - Fondo de cards: `#111827` (gris muy oscuro)
  - Fondo de cards internos: `#1a2332` / `#1f2937`
  - Bordes: `#1f2937` (gris oscuro)
  - Texto principal: `#e5e7eb` (blanco grisáceo)
  - Texto secundario: `#9ca3af` (gris medio)
  - Texto terciario: `#6b7280` (gris bajo)
  - Acento principal (azul): `#3b82f6`
  - Acento éxito (verde): `#10b981`
  - Acento peligro (rojo): `#ef4444`
  - Acento info (azul claro): `#3b82f6`
- **Tipografía**: System UI stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Monospace para código/rutas (`monospace`).
- **Border radius**: 8px para elementos pequeños, 12px para cards.
- **Sombras**: Minimalistas, sin sombras pesadas. Usar bordes sutiles para separación.

---

## 2. Layout principal

La app tiene un layout de **sidebar + contenido**:

```
┌─────────────────────────────────────────────────┐
│ HEADER (logo + status)                          │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ SIDEBAR  │         CONTENIDO (cambia por tab)   │
│ (nav)    │                                      │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### Header
- Altura: ~64px
- Fondo: `#111827`, borde inferior `#1f2937`
- Contenido izquierdo: Logo "🧠 Cerebro Virtual" (texto, 1.5rem, font-weight 600)
- Contenido derecho: Status dot (verde=healthy, rojo=offline) + texto del estado
- Max width: 1200px, centrado

### Sidebar
- Ancho: 200px
- Fondo: transparente (hereda del body `#0a0a0a`)
- 4 botones de navegación verticales:
  1. `📊 Dashboard`
  2. `💬 Hermes` (o el nombre del agente configurado)
  3. `🧠 Grafo`
  4. `⚙️ Ajustes`
- Botón activo: fondo `#1f2937`, texto azul `#3b82f6`, font-weight 500
- Botón inactivo: texto gris `#9ca3af`, hover: fondo `#1f2937`
- Padding: 0.75rem 1rem, border-radius 8px

### Contenido
- Flex: 1
- Padding: 2rem
- Max width del contenedor padre: 1200px

---

## 3. Pantalla de carga (Loading)

Aparece en 3 momentos:
1. Al arrancar la app ("Cargando Cerebro Virtual...")
2. Al iniciar el agente ("🚀 Iniciando el agente... Esto puede tomar unos minutos." + subtexto "Construyendo el entorno de Hermes Agent...")
3. Al subir un archivo ("📤 Subiendo y procesando a wiki...")

**Diseño**:
- Pantalla completa centrada
- Spinner circular: 50px, borde 3px `#1f2937`, top `#3b82f6`, animación rotate 1s
- Texto debajo: 1rem, color `#e5e7eb`
- Subtexto: 0.875rem, color `#6b7280`

---

## 4. Setup Wizard (Primera configuración)

Aparece solo la primera vez (cuando no hay configuración guardada). 2 pasos:

### Step 1: Configuración del Agente

**Estructura**: Card centrada, max-width ~500px, fondo `#0a0a0a` con borde.

**Indicador de pasos**: 2 cuadros en grid ("Configuración" → "Confirmar"). El paso actual tiene borde azul y fondo azul transparente.

**Campos del formulario** (en orden vertical):

1. **🔑 API Key de OpenRouter**
   - Label arriba
   - Input type=password, placeholder "sk-or-v1-..."
   - Caja de info abajo: icono ℹ️ + texto "Obtén tu API key en [OpenRouter](link)"
   - Validación: obligatorio, rojo si vacío

2. **📝 Nombre del agente**
   - Input type=text, placeholder "Ej: Hermes, Athena, etc."
   - Validación: obligatorio
   - Default: "Hermes"

3. **🧬 Personalidad**
   - Textarea, 4 filas
   - Placeholder: "Describe la personalidad de tu agente..."
   - Validación: obligatorio
   - Default: "Eres un asistente útil, amigable y profesional..."

4. **🔒 Credenciales del Dashboard** (separado por border-top)
   - Sub-label: "Protege el acceso al dashboard. Deja en blanco para acceso público (solo localhost)."
   - Input text: "Usuario (ej: admin)"
   - Input password: "Contraseña (mínimo 4 caracteres)"
   - Validación: si hay usuario, contraseña mín 4 chars

5. **📡 Canales de mensajería (opcional)** (separado por border-top)
   - Sub-label: "Conecta tu agente a otras plataformas. Deja en blanco si solo quieres la web."
   - 3 checkboxes:
     - Telegram → al activar, aparece input text "Token del bot (BotFather)"
     - Discord → al activar, aparece input text "Token del bot (Discord Developer Portal)"
     - WhatsApp → al activar, aparece input text "Número de teléfono (ej: +34 600 000 000)"

**Botón inferior**: "Siguiente →", azul, full-width, flex:1

### Step 2: Confirmar y Crear

**Resumen** en card oscuro con filas label/valor:
- Tipo de modelo: "☁️ OpenRouter"
- API Key: "••••••••" + últimos 4 chars
- Nombre del agente: valor
- Personalidad: truncado a 80 chars + "..."
- Dashboard: "admin (protegido)" o "Público (localhost)"

**Log de instalación** (aparece durante la creación):
- Terminal-style: fondo `#0a0a0a`, monospace, 0.8rem
- Líneas con emojis: ⚙️, ✅, 🚀, 🎉, ❌
- Max-height 200px, scroll

**Botones**:
- "← Atrás" (secundario, gris)
- "🧠 Crear cerebro virtual" (primario, azul, flex:1)
- Durante creación: "⏳ Creando..." (disabled)

---

## 5. Dashboard (tab: `📊 Dashboard`)

### Stats grid
3 cards horizontales (grid auto-fit, min 150px):
- `📖 Wiki` — número grande (2rem, azul `#3b82f6`)
- `📦 Raw` — número grande
- `📤 Outputs` — número grande

### Card: Información del sistema
- Título: "🖥️ Información del sistema"
- Campos:
  - Versión del sistema: valor
  - Nombre del agente: valor
  - Puerto de Hermes: `8080` (monospace, azul)
- **Estado de contenedores**: lista vertical, cada fila:
  - Punto verde/rojo (10px, círculo)
  - Nombre del contenedor (font-weight 500)
  - Estado a la derecha: "● running" (verde) o "● stopped" (rojo)
  - Fondo: `#1a2332`, border `#1f2937`, border-radius 6px, padding 0.4rem 0.75rem

### Card: Información del Vault
- Título: "ℹ️ Información del Vault"
- Campos: Nombre, Versión (schema), Creado (fecha), Agente

---

## 6. Chat (tab: `💬 Hermes`)

### Estructura
```
┌──────────────────────────────────────┐
│ Título: "💬 Habla con Hermes"        │
├──────────────────────────────────────┤
│                                      │
│  Área de mensajes (scroll)           │
│  - Mensajes usuario (derecha)        │
│  - Mensajes asistente (izquierda)    │
│  - Indicador "⏳ Hermes está pensando"│
│  - Indicador "📤 Subiendo y proc..." │
│                                      │
├──────────────────────────────────────┤
│ [Preview archivo adjunto si hay]     │
├──────────────────────────────────────┤
│ [📎] [Input texto...........] [Enviar]│
└──────────────────────────────────────┘
```

### Área de mensajes
- Mensaje vacío: texto centrado, gris `#6b7280`: "Pregúntale a Hermes sobre tus notas, proyectos o cualquier cosa en tu cerebro virtual."
- **Mensaje usuario** (`.chat-message`):
  - Fondo `#1f2937`, border-radius 8px, padding 1rem
  - Texto: `white-space: pre-wrap` (respeta saltos de línea)
  - Si tiene adjunto: chip debajo del texto con "📎 filename"
- **Mensaje asistente** (`.chat-message.assistant`):
  - Fondo `#1a2332`, border-left 3px `#3b82f6`
  - Mismo formato de texto
- **Indicador de carga**: mensaje asistente con "⏳ Hermes está pensando..."
- **Indicador de upload**: mensaje asistente con "📤 Subiendo y procesando a wiki..."

### Drag-and-drop
- Al arrastrar un archivo sobre el chat: overlay semi-transparente azul
  - Borde: 3px dashed `#3b82f6`, border-radius 12px
  - Centro: caja negra con texto "📎 Suelta tu archivo aquí" (1.5rem, azul)

### Preview de archivo adjunto (WhatsApp-style)
Aparece entre el área de mensajes y el input. Card horizontal:
- **Max-width**: 320px
- **Fondo**: `#1a2332`, borde `#3b82f6`, border-radius 8px, padding 0.5rem

**Thumbnail izquierdo** (48x48px, border-radius 6px):
- Imagen: `<img>` real (thumbnail del archivo)
- Audio: caja negra con emoji 🎵 (1.5rem)
- Video: caja negra con emoji 🎬
- Documento: caja negra con emoji 📄

**Info central** (flex:1, overflow hidden):
- Nombre del archivo (font-weight 500, ellipsis si muy largo)
- Estado: "✅ Wiki" (verde) si ya se procesó, "Procesando…" (gris) si aún no

**Botón cerrar** (✕): círculo rojo 20x20px

### Input area
- Botón 📎 (adjuntar): cuadrado, fondo `#1f2937`, borde `#374151`
- Input texto: flex:1, fondo `#1f2937`, borde `#374151`, focus: borde azul
- Placeholder: "Escribe tu pregunta... (arrastra archivos para adjuntar)"
- Botón Enviar: azul `#3b82f6`, hover `#2563eb`
- Enter envía el mensaje
- Formatos aceptados: pdf, png, jpg, jpeg, gif, webp, txt, md, mp3, wav, ogg, m4a, mp4, webm, mov, csv, json, yaml, yml

---

## 7. Grafo de Conocimiento (tab: `🧠 Grafo`)

### Header
- Título: "🧠 Grafo de Conocimiento"
- Subtítulo: "X páginas · Y enlaces" (gris, 0.875rem)

### Visualización
- **SVG** centrado, max-width 700px
- Layout circular: nodos distribuidos en círculo (radio 200px, centro 350,250)
- **Nodos**:
  - Página wiki real (con archivo): círculo 8px, fill azul `#3b82f6`
  - Referencia (sin archivo): círculo 5px, fill gris `#6b7280`
  - Borde: `#0a0a0a`, 1px
  - Label arriba: título truncado a 15 chars, gris `#9ca3af`, 10px
- **Aristas**: línea recta `#374151`, 1.5px

### Estado vacío
- Texto centrado: "No hay páginas wiki todavía. Procesa archivos desde el chat para crearlas."

---

## 8. Ajustes (tab: `⚙️ Ajustes`)

Sección de cards verticales, cada una con margin-bottom 1.5rem.

### Card 1: 🧠 Agente Principal
- Descripción: "Configura el nombre y la personalidad de tu agente."
- **Modo vista**: 
  - Nombre (font-weight 500)
  - Personalidad truncada (max 400px, 100 chars + "...")
  - Botones: "✏️ Editar" (gris) + "🔄 Reiniciar" (verde)
- **Modo edición**:
  - Input "Nombre del agente"
  - Textarea "Personalidad" (4 filas, resize vertical)
  - Botones: "💾 Guardar" (azul) + "Cancelar" (gris) + "🔄 Reiniciar agente" (verde)
  - Mensaje de feedback (verde/rojo según éxito/error)

### Card 2: 🔑 APIs Agentes
- Descripción: "Configura las API keys para los agentes del sistema."
- Fila con nombre del agente + badge de estado:
  - "🧠 Hermes" + badge "✅ Configurada" (verde) o "❌ No configurada" (gris)
  - "OpenRouter" a la derecha (gris pequeño)
- Input password + botones:
  - Input: monospace, placeholder "sk-or-v1-..."
  - "Guardar" (azul)
  - "Eliminar" (rojo, solo si ya configurada)
- Mensaje de feedback
- Footer: "💡 Obtén tu API key en [OpenRouter](link)"

### Card 3: 📦 Vault
- Descripción: "Exporta o importa el vault completo (incluye wiki, raw files y outputs)."
- 2 botones horizontales:
  - "📤 Exportar vault" (azul)
  - "📥 Importar vault" (verde) → abre selector de archivo (.tar.gz)
- Mensaje de feedback (info=azul, éxito=verde, error=rojo)
- Importar pide confirmación: "⚠️ ¿Estás seguro? Importar un vault reemplazará los datos actuales."

### Card 4: 📊 Estado del Sistema
- Texto simple, una línea por campo:
  - Agente: valor
  - API Key: ✅/❌
  - Vault Path: ruta
  - Versión: número

### Card 5: 📡 Canales de mensajería
- Descripción: "Conecta tu agente a Telegram, Discord o WhatsApp."
- Caja informativa: "Para añadir o modificar canales, ve al [Panel de Hermes](http://localhost:8080) → Settings → Gateway."
- Subtexto: "Hermes soporta: Telegram, Discord, Slack, WhatsApp, Signal, Email, SMS, Matrix, Teams y más."

### Card 6: 🔗 Panel de Hermes
- Descripción: "Accede al panel completo de control de tu agente."
- Botón-link: "🔗 Abrir Panel de Hermes" (estilo botón, hover cambia fondo)

### Card 7: ⚠️ Zona Peligrosa
- Borde de la card: rojo `#ef4444`
- Título en rojo
- Descripción: "Restablecer toda la configuración del agente. **Tus notas y archivos NO se perderán.**"
- Botón: "🗑️ Restablecer configuración" (rojo, hover más oscuro)
- Doble confirmación (2 alerts antes de ejecutar)

---

## 9. Flujos de usuario

### Flujo 1: Primera configuración
1. Usuario ejecuta `start.bat`
2. Docker construye y arranca contenedores
3. Usuario abre `http://localhost:5173`
4. Ve el Wizard → introduce API key, nombre, personalidad
5. (Opcional) Activa Telegram/Discord/WhatsApp con tokens
6. Revisa resumen → click "🧠 Crear cerebro virtual"
7. Ve log de instalación → app carga Dashboard

### Flujo 2: Subir archivo y procesar
1. Usuario va al tab Chat
2. Arrastra archivo al área de chat (o click 📎)
3. Aparece preview WhatsApp-style con thumbnail
4. Backend sube archivo a `raw/chat/` → extrae texto → sintetiza wiki → guarda en `wiki/`
5. Preview muestra "✅ Wiki" cuando termina
6. Mensaje automático del asistente: "✅ archivo.txt procesado → wiki/archivo.md"
7. Dashboard actualiza stats (wiki_pages +1)
8. Grafo actualiza nodos

### Flujo 3: Preguntar sobre el contenido
1. Usuario escribe pregunta en el chat
2. Backend busca en `wiki/` por palabras clave (acento-insensible)
3. Si hay resultados: se inyectan como contexto en el mensaje a Hermes
4. Hermes responde basándose en el vault
5. Respuesta aparece en el chat
6. `vault_results` en el context indica cuántos resultados encontró

### Flujo 4: Ver grafo de conocimiento
1. Usuario va al tab Grafo
2. Ve nodos (páginas wiki) y aristas (wikilinks entre ellas)
3. Nodos azules = páginas reales, grises = referencias sin archivo
4. Contador arriba: "X páginas · Y enlaces"

### Flujo 5: Exportar/Importar vault
1. Usuario va a Ajustes → Vault
2. Click "📤 Exportar" → descarga `vault-export.tar.gz`
3. Para importar: click "📥 Importar" → selecciona .tar.gz → confirma → vault se reemplaza

### Flujo 6: Cambiar API key
1. Ajustes → APIs Agentes
2. Pega nueva key → click Guardar
3. Feedback verde "✅ API key guardada"

### Flujo 7: Reiniciar agente
1. Ajustes → Agente Principal → "🔄 Reiniciar"
2. Confirm dialog
3. Agente se reinicia (aplica cambios de nombre/personalidad)

### Flujo 8: Reset total
1. Ajustes → Zona Peligrosa → "🗑️ Restablecer"
2. Doble confirmación
3. Configuración borrada, agente detenido
4. Página recarga → vuelve al Wizard

---

## 10. Estados de feedback

### Mensajes inline (dentro de cards)
- **Éxito**: fondo verde transparente `rgba(16,185,129,0.15)`, texto verde `#10b981`
- **Error**: fondo rojo transparente `rgba(239,68,68,0.15)`, texto rojo `#ef4444`
- **Info**: fondo azul transparente `rgba(59,130,246,0.15)`, texto azul `#3b82f6`

### Badges
- Configurada: verde, fondo `rgba(16,185,129,0.15)`, padding 2px 10px, border-radius 12px
- No configurada: gris, fondo `rgba(107,114,128,0.15)`

### Alerts (nativos del navegador)
- Usados para confirmaciones destructivas (reiniciar, reset, eliminar key)
- **Idealmente reemplazar por modales custom** en el rediseño

### Indicadores de carga
- Spinner: círculo rotando, borde `#1f2937` + top `#3b82f6`
- Texto "⏳" como placeholder en botones durante carga
- "⏳ Guardando..." / "⏳ Creando..." / "⏳ Reiniciando..." / "⏳ Importando..."

---

## 11. Responsive

- **Desktop** (>768px): Sidebar visible, contenido a la derecha
- **Mobile** (<768px): Sidebar colapsable o tabs inferiores. Contenido full-width. (No implementado actualmente, ideal para el rediseño)

---

## 12. Elementos a mejorar en el rediseño

1. **Alerts nativos → modales custom**: los `alert()` y `confirm()` rompen la experiencia
2. **Grafo interactivo**: actualmente SVG estático. Ideal: drag de nodos, zoom, click para ver página
3. **Markdown rendering**: las respuestas del chat y las páginas wiki se muestran como texto plano. Ideal: renderizar Markdown (negrita, listas, código, wikilinks clicables)
4. **Sidebar responsive**: colapsar en mobile
5. **Toast notifications**: para feedback de acciones (key guardada, vault exportado)
6. **Avatar del agente**: imagen/icono personalizable en el chat
7. **Dark/light toggle**: actualmente solo dark
8. **Búsqueda global**: input en el header para buscar en todo el vault
9. **Lista de archivos raw**: actualmente no hay vista para ver los archivos subidos, solo el contador
10. **Lista de páginas wiki**: igual, no hay vista para ver/listar las páginas wiki creadas
