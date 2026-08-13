import React from 'react'

// ponytail: parser Markdown → React elements. Sin deps externas. Obsidian Deep theme.
// Soporta: h1-h4, bold, italic, code, code blocks, tablas, listas (ul/ol), wikilinks, links, blockquotes, hr.

function MarkdownViewer({ content, style }) {
  if (!content) return null
  return <div style={{ ...style }}>{parseMarkdown(content)}</div>
}

function parseMarkdown(md) {
  const lines = md.split('\n')
  const elements = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block ```lang ... ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={key++} style={{
          background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
          padding: '12px 16px', overflowX: 'auto', margin: '10px 0',
          border: '1px solid var(--color-surface-high)',
        }}>
          {lang && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{lang}</div>}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Table — detect header row + separator
    if (line.includes('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|/.test(lines[i + 1].trim())) {
      const tableLines = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(renderTable(tableLines, key++))
      continue
    }

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={key++} style={{ margin: '10px 0 4px', color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600 }}>{renderInline(line.slice(5))}</h4>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} style={{ margin: '14px 0 6px', color: 'var(--color-text-primary)', fontSize: 16, fontWeight: 600 }}>{renderInline(line.slice(4))}</h3>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} style={{ margin: '18px 0 8px', color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 700 }}>{renderInline(line.slice(3))}</h2>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} style={{ margin: '20px 0 10px', color: 'var(--color-primary)', fontSize: 22, fontWeight: 700 }}>{renderInline(line.slice(2))}</h1>)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <blockquote key={key++} style={{
          borderLeft: '3px solid var(--color-primary)', paddingLeft: '12px',
          margin: '10px 0', color: 'var(--color-text-secondary)', fontSize: 13,
          background: 'rgba(173,198,255,0.04)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          padding: '8px 12px',
        }}>
          {quoteLines.map((l, j) => <div key={j}>{renderInline(l)}</div>)}
        </blockquote>
      )
      continue
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--color-surface-high)', margin: '16px 0' }} />)
      i++; continue
    }

    // Unordered list
    if (line.match(/^[\s]*[-*+]\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[\s]*[-*+]\s/)) {
        const indent = lines[i].match(/^[\s]*/)[0].length
        const text = lines[i].replace(/^[\s]*[-*+]\s/, '')
        items.push({ indent, text })
        i++
      }
      elements.push(renderList(items, 'ul', key++))
      continue
    }

    // Ordered list
    if (line.match(/^[\s]*\d+\.\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[\s]*\d+\.\s/)) {
        const indent = lines[i].match(/^[\s]*/)[0].length
        const text = lines[i].replace(/^[\s]*\d+\.\s/, '')
        items.push({ indent, text })
        i++
      }
      elements.push(renderList(items, 'ol', key++))
      continue
    }

    // Empty line
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph
    elements.push(<p key={key++} style={{ margin: '6px 0', color: 'var(--color-text-secondary)', fontSize: 13.5, lineHeight: 1.7 }}>{renderInline(line)}</p>)
    i++
  }

  return elements
}

function renderTable(tableLines, key) {
  // ponytail: parse GFM table. First row = header, second = separator, rest = data.
  const parseRow = (line) => line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1)
  const headers = parseRow(tableLines[0])
  const rows = tableLines.slice(2).map(parseRow)

  return (
    <div key={key} style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse', fontSize: 13,
        border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
      }}>
        <thead>
          <tr>
            {headers.map((h, j) => (
              <th key={j} style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                color: 'var(--color-text-primary)', background: 'var(--color-surface-high)',
                borderBottom: '1px solid var(--color-surface-high)',
              }}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              {headers.map((_, ci) => (
                <td key={ci} style={{
                  padding: '6px 12px', color: 'var(--color-text-secondary)',
                  borderBottom: '1px solid var(--color-surface-high)',
                }}>{renderInline(row[ci] || '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderList(items, type, key) {
  // ponytail: flatten nested lists by indent level
  const root = { children: [] }
  const stack = [{ node: root, indent: -1 }]

  for (const item of items) {
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop()
    }
    const parent = stack[stack.length - 1].node
    const node = { text: item.text, children: [] }
    parent.children.push(node)
    stack.push({ node, indent: item.indent })
  }

  const renderNodes = (nodes) => nodes.map((n, j) => (
    <li key={j} style={{ margin: '3px 0', color: 'var(--color-text-secondary)', fontSize: 13.5, lineHeight: 1.6 }}>
      {renderInline(n.text)}
      {n.children.length > 0 && (
        type === 'ul' ? <ul style={{ margin: '4px 0 4px 16px', listStyle: 'none' }}>{renderNodes(n.children)}</ul>
                     : <ol style={{ margin: '4px 0 4px 16px' }}>{renderNodes(n.children)}</ol>
      )}
    </li>
  ))

  return type === 'ul'
    ? <ul key={key} style={{ margin: '6px 0', paddingLeft: '20px', listStyle: 'disc' }}>{renderNodes(root.children)}</ul>
    : <ol key={key} style={{ margin: '6px 0', paddingLeft: '20px' }}>{renderNodes(root.children)}</ol>
}

function renderInline(text) {
  if (!text) return ''
  const parts = []
  let remaining = text
  let key = 0

  while (remaining) {
    // [[wikilink]]
    const wl = remaining.match(/\[\[([^\]]+)\]\]/)
    // **bold**
    const bold = remaining.match(/\*\*([^*]+)\*\*/)
    // *italic*
    const italic = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)
    // `code`
    const code = remaining.match(/`([^`]+)`/)
    // [text](url)
    const link = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    const matches = [wl, bold, italic, code, link].filter(Boolean).sort((a, b) => a.index - b.index)
    if (!matches.length) { parts.push(remaining); break }

    const m = matches[0]
    if (m.index > 0) parts.push(remaining.slice(0, m.index))

    if (wl && m === wl) {
      parts.push(<span key={key++} style={{ color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>{m[1]}</span>)
    } else if (bold && m === bold) {
      parts.push(<strong key={key++} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{m[1]}</strong>)
    } else if (italic && m === italic) {
      parts.push(<em key={key++}>{m[1]}</em>)
    } else if (code && m === code) {
      parts.push(<code key={key++} style={{ background: 'var(--color-surface-high)', padding: '2px 5px', borderRadius: '3px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-primary)' }}>{m[1]}</code>)
    } else if (link && m === link) {
      parts.push(<a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{m[1]}</a>)
    }

    remaining = remaining.slice(m.index + m[0].length)
  }

  return parts
}

export default MarkdownViewer