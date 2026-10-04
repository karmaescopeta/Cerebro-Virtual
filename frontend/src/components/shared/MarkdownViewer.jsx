import React from 'react'
import mdTheme, { slugify } from '../../mdTheme'

// ponytail: parser Markdown → React elements. Sin deps externas. Obsidian Deep theme.
// Soporta: h1-h4, bold, italic, code, code blocks, tablas, listas (ul/ol), wikilinks, links, blockquotes, hr.
// Estilos en mdTheme.js. compact=true = escala burbuja de chat; false = escala de lectura (documentos).

function MarkdownViewer({ content, style, compact = false }) {
  if (!content) return null
  return <div style={{ ...style }}>{parseMarkdown(content, compact)}</div>
}

function parseMarkdown(md, compact) {
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
        <pre key={key++} style={mdTheme.codeBlock.pre(compact)}>
          {lang && <div style={mdTheme.codeBlock.lang(compact)}>{lang}</div>}
          <code style={mdTheme.codeBlock.code(compact)}>{codeLines.join('\n')}</code>
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
      elements.push(renderTable(tableLines, key++, compact))
      continue
    }

    // Headings — id slug en h1-h3 (solo documento) para el índice de DocReader
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={key++} style={mdTheme.h4(compact)}>{renderInline(line.slice(5), compact)}</h4>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} id={compact ? undefined : slugify(line.slice(4))} style={mdTheme.h3(compact)}>{renderInline(line.slice(4), compact)}</h3>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} id={compact ? undefined : slugify(line.slice(3))} style={mdTheme.h2(compact)}>{renderInline(line.slice(3), compact)}</h2>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} id={compact ? undefined : slugify(line.slice(2))} style={mdTheme.h1(compact)}>{renderInline(line.slice(2), compact)}</h1>)
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
        <blockquote key={key++} style={mdTheme.blockquote(compact)}>
          {quoteLines.map((l, j) => <div key={j}>{renderInline(l, compact)}</div>)}
        </blockquote>
      )
      continue
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={key++} style={mdTheme.hr(compact)} />)
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
      elements.push(renderList(items, 'ul', key++, compact))
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
      elements.push(renderList(items, 'ol', key++, compact))
      continue
    }

    // Empty line
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph
    elements.push(<p key={key++} style={mdTheme.p(compact)}>{renderInline(line, compact)}</p>)
    i++
  }

  return elements
}

function renderTable(tableLines, key, compact) {
  // ponytail: parse GFM table. First row = header, second = separator, rest = data.
  const parseRow = (line) => line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1)
  const headers = parseRow(tableLines[0])
  const rows = tableLines.slice(2).map(parseRow)
  const t = mdTheme.table

  return (
    <div key={key} style={t.wrap(compact)}>
      <table style={t.table(compact)}>
        <thead>
          <tr>
            {headers.map((h, j) => (
              <th key={j} style={t.th(compact)}>{renderInline(h, compact)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : t.rowAlt }}>
              {headers.map((_, ci) => (
                <td key={ci} style={t.td(compact)}>{renderInline(row[ci] || '', compact)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderList(items, type, key, compact) {
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
    <li key={j} style={mdTheme.li(compact)}>
      {renderInline(n.text, compact)}
      {n.children.length > 0 && (
        type === 'ul' ? <ul style={mdTheme.nested(compact)}>{renderNodes(n.children)}</ul>
                     : <ol style={mdTheme.nested(compact)}>{renderNodes(n.children)}</ol>
      )}
    </li>
  ))

  return type === 'ul'
    ? <ul key={key} style={mdTheme.ul(compact)}>{renderNodes(root.children)}</ul>
    : <ol key={key} style={mdTheme.ol(compact)}>{renderNodes(root.children)}</ol>
}

function renderInline(text, compact) {
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
      parts.push(<span key={key++} style={mdTheme.wikilink(compact)}>{m[1]}</span>)
    } else if (bold && m === bold) {
      parts.push(<strong key={key++} style={mdTheme.bold(compact)}>{m[1]}</strong>)
    } else if (italic && m === italic) {
      parts.push(<em key={key++} style={mdTheme.italic(compact)}>{m[1]}</em>)
    } else if (code && m === code) {
      parts.push(<code key={key++} style={mdTheme.code(compact)}>{m[1]}</code>)
    } else if (link && m === link) {
      parts.push(<a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" style={mdTheme.link(compact)}>{m[1]}</a>)
    }

    remaining = remaining.slice(m.index + m[0].length)
  }

  return parts
}

export default MarkdownViewer
