## ADDED Requirements

### Requirement: Componente MarkdownViewer reusable
El sistema SHALL proporcionar un componente React `MarkdownViewer` que renderice contenido Markdown a HTML con formato visual atractivo, integrado al design system Obsidian Deep. El componente MUST ser reusable desde cualquier vista del cerebro (chat, grafo, cerebro, preview modal).

#### Scenario: Renderizar títulos
- **WHEN** el Markdown contiene `# Título`, `## Subtítulo`, `### Sección`
- **THEN** el componente renderiza headings con jerarquía visual (h1 más grande que h2, h2 más grande que h3) usando `--color-text-primary` y `--color-primary`

#### Scenario: Renderizar formato inline
- **WHEN** el Markdown contiene `**bold**`, `*italic*`, `` `code` ``
- **THEN** bold se renderiza con `font-weight: 600`, italic con `font-style: italic`, code con background `--color-surface-high` y `font-family: var(--font-mono)`

#### Scenario: Renderizar code blocks
- **WHEN** el Markdown contiene bloques ` ```language ... ``` `
- **THEN** el componente renderiza `<pre><code>` con background `--color-bg`, border `--color-surface-high`, `overflow-x: auto`, `font-family: var(--font-mono)`

#### Scenario: Renderizar tablas
- **WHEN** el Markdown contiene tablas con `|` y `---` separator rows
- **THEN** el componente renderiza `<table>` con borders, header con background `--color-surface-high`, padding adecuado, alternating row colors

#### Scenario: Renderizar listas
- **WHEN** el Markdown contiene listas `- item` o `1. item`
- **THEN** listas unordered render con bullets, ordered con números, indentación anidada visible

#### Scenario: Renderizar wikilinks
- **WHEN** el Markdown contiene `[[Concepto]]`
- **THEN** el componente renderiza como span con `color: var(--color-primary)`, `cursor: pointer`, `text-decoration: underline`

#### Scenario: Renderizar blockquotes
- **WHEN** el Markdown contiene `> quote`
- **THEN** el componente renderiza con border-left `3px solid var(--color-primary)`, padding-left, background sutil

#### Scenario: Renderizar horizontal rules
- **WHEN** el Markdown contiene `---`
- **THEN** el componente renderiza `<hr>` con `border-top: 1px solid var(--color-surface-high)`

#### Scenario: Renderizar links
- **WHEN** el Markdown contiene `[text](url)`
- **THEN** el componente renderiza `<a>` con `color: var(--color-primary)`, `text-decoration: underline`, `target: _blank`

### Requirement: MarkdownViewer integrado en chat preview
El chat preview modal SHALL usar `MarkdownViewer` para mostrar documentos .md con formato visual.

#### Scenario: Preview desde investigar
- **WHEN** el usuario hace clic en "Visualizar" en un resultado de investigación
- **THEN** el modal abre con `MarkdownViewer` renderizando el documento completo con formato

### Requirement: MarkdownViewer integrado en GrafoView
GrafoView SHALL reemplazar su `renderMarkdown` local con `MarkdownViewer`.

#### Scenario: Preview wiki desde nodo del grafo
- **WHEN** el usuario hace clic en un nodo del grafo de estructura
- **THEN** el panel lateral usa `MarkdownViewer` para mostrar la wiki del nodo
