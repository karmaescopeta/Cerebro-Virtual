// mdTheme — estilo de cada elemento Markdown. Único punto de personalización.
// MarkdownViewer lo consume. Futuro premium: Ajustes podrá sobreescribir mdTheme por símbolo.
// Cada entrada es v(doc, compact): estilos de lectura (documentos, 15px base) + delta compacto (burbujas de chat, escala actual).

const v = (doc, compactDelta) => (compact) => (compact ? { ...doc, ...compactDelta } : doc)

const mdTheme = {
  h1: v({ margin: '28px 0 12px', color: 'var(--color-primary)', fontSize: 26, fontWeight: 700 }, { margin: '20px 0 10px', fontSize: 22 }),
  h2: v({ margin: '24px 0 10px', color: 'var(--color-text-primary)', fontSize: 21, fontWeight: 700 }, { margin: '18px 0 8px', fontSize: 18 }),
  h3: v({ margin: '18px 0 8px', color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 600 }, { margin: '14px 0 6px', fontSize: 16 }),
  h4: v({ margin: '14px 0 6px', color: 'var(--color-text-primary)', fontSize: 16, fontWeight: 600 }, { margin: '10px 0 4px', fontSize: 14 }),
  p: v({ margin: '10px 0', color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.8 }, { margin: '6px 0', fontSize: 13.5, lineHeight: 1.7 }),
  bold: v({ fontWeight: 600, color: 'var(--color-text-primary)' }),
  italic: v({}),
  code: v({ background: 'var(--color-surface-high)', padding: '2px 5px', borderRadius: '3px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-primary)' }, { fontSize: 12 }),
  codeBlock: {
    pre: v({ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', overflowX: 'auto', margin: '14px 0', border: '1px solid var(--color-surface-high)' }, { padding: '12px 16px', margin: '10px 0' }),
    lang: v({ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }),
    code: v({ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }, { fontSize: 13, lineHeight: 1.5 }),
  },
  blockquote: v({ borderLeft: '3px solid var(--color-primary)', paddingLeft: '12px', margin: '14px 0', color: 'var(--color-text-secondary)', fontSize: 14, background: 'color-mix(in srgb, var(--color-primary) 4%, transparent)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', padding: '10px 14px' }, { margin: '10px 0', fontSize: 13, padding: '8px 12px' }),
  hr: v({ border: 'none', borderTop: '1px solid var(--color-surface-high)', margin: '20px 0' }, { margin: '16px 0' }),
  ul: v({ margin: '8px 0', paddingLeft: '20px', listStyle: 'disc' }),
  ol: v({ margin: '8px 0', paddingLeft: '20px' }),
  li: v({ margin: '4px 0', color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.7 }, { margin: '3px 0', fontSize: 13.5, lineHeight: 1.6 }),
  nested: v({ margin: '4px 0 4px 16px' }),
  table: {
    wrap: v({ overflowX: 'auto', margin: '12px 0' }),
    table: v({ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }, { fontSize: 13 }),
    th: v({ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-primary)', background: 'var(--color-surface-high)', borderBottom: '1px solid var(--color-surface-high)' }),
    td: v({ padding: '7px 12px', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-surface-high)' }, { padding: '6px 12px' }),
    rowAlt: 'color-mix(in srgb, var(--color-text-primary) 2%, transparent)',
  },
  link: v({ color: 'var(--color-primary)', textDecoration: 'underline' }),
  wikilink: v({ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }),
}

// Slug de heading → id para el índice clicable de DocReader. Colisiones toleradas (primer match gana).
export function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default mdTheme