# research-writing-standards Specification

## Purpose
TBD - created by archiving change investigador-v2. Update Purpose after archive.
## Requirements
### Requirement: Plantilla .md fija
El perfil investigador SHALL generar TODO documento con la estructura fija: `# Título / ## Resumen / ## Desarrollo (secciones ## y ###) / ## Conclusiones / ## Fuentes`, con [[wikilinks]] en el desarrollo. Solo cambia cómo se explica el contenido, nunca la estructura.

#### Scenario: Estructura idéntica entre docs
- WHEN se generan dos investigaciones de temas distintos
- THEN ambas tienen exactamente las mismas secciones raíz en el mismo orden

#### Scenario: Resumen breve
- WHEN se genera el documento
- THEN "## Resumen" tiene 3-5 líneas (extraíble por `_extract_summary` existente)

### Requirement: Normas anti-IA de escritura
El SOUL.md del investigador SHALL incluir normas de estilo destiladas del skill humanizer que prohíban: construcciones "no es X sino Y", muletillas de arranque ("En el mundo de…", "Es importante destacar", "Cabe señalar"), adjetivos vacíos, resúmenes finales que repiten lo ya dicho, y generalidad sin datos. Y SHALL exigir: frases cortas y directas, concreción sobre generalidad, escribir a UNA persona.

#### Scenario: Texto sin tics de IA
- WHEN el investigador genera un documento
- THEN el texto no contiene las construcciones prohibidas y mantiene voz directa independiente del nivel elegido

### Requirement: Reglas por nivel
El SOUL.md SHALL definir cómo varía la explicación según el nivel SIN variar la estructura: principiante (sin jerga, analogías cotidianas), intermedio (equilibrado), experto (directo al grano, técnico, sin explicaciones básicas).

#### Scenario: Mismo tema, tres niveles
- WHEN se investiga el mismo tema en los tres niveles
- THEN la estructura .md es idéntica y cambia la densidad técnica y el vocabulario del desarrollo

