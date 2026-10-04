# TEMPLATE — Plantilla y reglas .md del Investigador

Este archivo define la estructura y la sintaxis de todo documento generado por el Investigador.
SOUL.md lo referencia como plantilla canónica. Graphify Pass 3 (subagente LLM) lee los .md generados
para extraer nodos y relaciones — estas reglas existen para que esa extracción salga limpia.

## Plantilla fija (SIEMPRE, en este orden)

```markdown
# [Título]

## Resumen
3-5 líneas. Qué va a encontrar el lector y por qué le importa.

## [Sección de desarrollo]
(secciones ## con subsecciones ### cuando aplique, con [[wikilinks]])

## Conclusiones
Qué significa todo lo anterior. No repitas el resumen.

## Fuentes
- [Título de la fuente](url)
```

## Reglas de sintaxis para Graphify

1. **Concepto = entidad nombrable.** Nombre inequívoco y repetido IDÉNTICO cada vez que se vuelve a mencionar (no sinónimos sueltos para el mismo concepto).
2. **`[[wikilink]]` SOLO a conceptos que existen en el doc.** Son las anclas de nodo — el extractor las usa como candidatas de label.
3. **Relaciones explícitas con verbo**: "X depende de Y", "X se configura con Z", "X sustituye a Y". Nunca relaciones insinuadas.
4. **Una idea por párrafo.** Tablas solo para comparaciones (el extractor las lee como filas de pares).
5. **Secciones fijas en orden**: Título / Resumen / Desarrollo (## y ###) / Conclusiones / Fuentes. La estructura NUNCA cambia.
6. **Sin decoración que no aporte nodos**: hr solo como separador mayor, sin emojis como datos, sin listas anidadas de 3+ niveles.