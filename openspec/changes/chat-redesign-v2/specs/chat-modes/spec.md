## ADDED Requirements

### Requirement: Modos de chat con toggles
El sistema SHALL tener 3 toggles en la barra de botones: "Chat inteligente", "Cerebro", "Búsqueda en Internet". El botón "Búsqueda en Internet" solo aparece cuando Cerebro está ON.

#### Scenario: Chat normal (default)
- **WHEN** ningún toggle está activado
- **THEN** el chat funciona como ChatGPT normal usando perfil `chat-default`. Busca internet por defecto.

#### Scenario: Chat inteligente ON
- **WHEN** el usuario activa "Chat inteligente" sin Cerebro
- **THEN** se usa perfil `chat-smart`. El toggle se mantiene ON hasta que se desactiva manualmente.

#### Scenario: Cerebro ON
- **WHEN** el usuario activa "Cerebro"
- **THEN** se ignora "Chat inteligente" (se desactiva visualmente). Se usa perfil `cerebro`. Aparece botón "Búsqueda en Internet" a la derecha.

#### Scenario: Cerebro OFF después de ON
- **WHEN** el usuario desactiva "Cerebro"
- **THEN** "Búsqueda en Internet" desaparece. Si "Chat inteligente" estaba ON antes de activar Cerebro, vuelve a ON.

### Requirement: Búsqueda en Internet con Cerebro
El sistema SHALL mostrar un botón "Búsqueda en Internet" cuando Cerebro está ON. Es un toggle que se mantiene activo.

#### Scenario: Cerebro ON + Internet OFF
- **WHEN** Cerebro activado, Internet desactivado
- **THEN** el sistema busca solo en el vault. Si no encuentra información, responde "No he encontrado información" sin buscar en internet.

#### Scenario: Cerebro ON + Internet ON
- **WHEN** Cerebro activado, Internet activado
- **THEN** el sistema busca primero en el vault. La respuesta se divide en 2 secciones: 🧠 Cerebro (info del vault o "sin resultados") y 🌐 Internet (resumen breve de resultados web).

### Requirement: Búsqueda internet sin Cerebro
El sistema SHALL buscar en internet por defecto cuando Cerebro está OFF. El modelo usa los resultados de SearXNG para responder.

#### Scenario: Chat normal con búsqueda
- **WHEN** el usuario envía un mensaje sin Cerebro
- **THEN** el backend consulta SearXNG, pasa resultados al modelo como contexto, y devuelve la respuesta

### Requirement: Orden de botones
El sistema SHALL mostrar los botones en este orden: `[Añadir archivos] [Chat inteligente] [Cerebro] [Búsqueda Internet] [Investigar]`.

#### Scenario: Visibilidad de botones
- **WHEN** Cerebro está OFF
- **THEN** "Búsqueda en Internet" no se renderiza. Los demás botones están visibles.

#### Scenario: Visibilidad con Cerebro ON
- **WHEN** Cerebro está ON
- **THEN** todos los botones están visibles incluyendo "Búsqueda en Internet".

### Requirement: Respuesta dividida
El sistema SHALL dividir la respuesta en 2 secciones cuando Cerebro ON + Internet ON.

#### Scenario: Respuesta con info en cerebro + internet
- **WHEN** Cerebro ON + Internet ON y hay info en el vault
- **THEN** la burbuja del assistant muestra: sección 🧠 con info del vault + divisor + sección 🌐 con resumen de internet

#### Scenario: Respuesta sin info en cerebro
- **WHEN** Cerebro ON + Internet ON y NO hay info en el vault
- **THEN** la burbuja muestra: sección 🧠 "No se encontró información en el cerebro" + divisor + sección 🌐 con resumen de internet
