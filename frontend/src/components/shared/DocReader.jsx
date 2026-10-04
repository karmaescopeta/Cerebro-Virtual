import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'

// ponytail: visor-editor compartido (fase 3) — TipTap in place, menú "/" y markdown ida-vuelta.
// [[wikilinks]] viajan como [label](wiki:label) dentro del editor (no es md estándar) y vuelven a [[...]] al serializar.
// onSaveEdit(md) async — el caller decide endpoint (update-file / save-output), formato Graphify y toast.
// status = {in_graph, stale} — icono de cerebro en la cabecera (verde al día / naranja modificado / gris fuera).

const toWiki = (md) => md.replace(/\[\[([^\]\[]+)\]\]/g, (_, l) => `[${l}](wiki:${encodeURIComponent(l.trim())})`)
const fromWiki = (md) => md.replace(/\[([^\]]+)\]\(wiki:([^)]+)\)/g, (_, l, e) => `[[${decodeURIComponent(e)}]]`)

const SLASH_ITEMS = [
  { label: 'Texto', desc: 'Párrafo normal', cmd: (c) => c.setParagraph() },
  { label: 'Título 1', desc: 'Sección grande', cmd: (c) => c.toggleHeading({ level: 1 }) },
  { label: 'Título 2', desc: 'Subsección', cmd: (c) => c.toggleHeading({ level: 2 }) },
  { label: 'Título 3', desc: 'Subsubsección', cmd: (c) => c.toggleHeading({ level: 3 }) },
  { label: 'Lista con viñetas', desc: 'Elementos sueltos', cmd: (c) => c.toggleBulletList() },
  { label: 'Lista numerada', desc: 'Pasos o ranking', cmd: (c) => c.toggleOrderedList() },
  { label: 'Tabla', desc: 'Comparación de datos', cmd: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { label: 'Cita', desc: 'Texto destacado', cmd: (c) => c.toggleBlockquote() },
  { label: 'Código', desc: 'Bloque de código', cmd: (c) => c.toggleCodeBlock() },
  { label: 'Separador', desc: 'Línea divisoria', cmd: (c) => c.setHorizontalRule() },
]

export default function DocReader({ title, context, content, onClose, actions = [], onSaveEdit, status }) {
  const bodyRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  const [slash, setSlash] = useState(null) // {x, y, query}
  const [slashIdx, setSlashIdx] = useState(0) // fase investigador: item resaltado del menú "/"
  const [menuOpen, setMenuOpen] = useState(false) // índice móvil
  const originalRef = useRef(content || '')
  // ponytail: handleKeyDown vive en el closure de useEditor (se crea 1 vez) — el estado del menú viaja por refs
  const slashRef = useRef(null)
  const slashIdxRef = useRef(0)
  const applyRef = useRef(null) // applySlash fresco en cada render

  const editor = useEditor({
    editable: !!onSaveEdit,
    content: toWiki(content || ''),
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      Link.configure({ protocols: ['wiki'], openOnClick: false, linkify: false, autolink: false }),
      Markdown.configure({ html: false, breaks: true, linkify: false }),
    ],
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === '/' && view.state.selection.empty) {
          const { from } = view.state.selection
          const before = view.state.doc.textBetween(Math.max(0, from - 1), from)
          if (before === '') {
            setTimeout(() => {
              const rect = window.getSelection()?.getRangeAt(0)?.getBoundingClientRect()
              if (rect) {
                slashRef.current = { x: rect.left, y: rect.bottom + 4, query: '' }
                slashIdxRef.current = 0
                setSlash(slashRef.current)
                setSlashIdx(0)
              }
            }, 10)
            return false
          }
        }
        const s = slashRef.current
        if (s) {
          const items = SLASH_ITEMS.filter(i => (s.query || '') === '' || i.label.toLowerCase().includes(s.query.toLowerCase()))
          if (event.key === 'Escape') {
            slashRef.current = null; setSlash(null); return true
          }
          // fase investigador: flechas mueven el resaltado, Enter aplica — navegación por teclado del menú "/"
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
            event.preventDefault()
            slashIdxRef.current = event.key === 'ArrowDown'
              ? (slashIdxRef.current + 1) % items.length
              : (slashIdxRef.current - 1 + items.length) % items.length
            setSlashIdx(slashIdxRef.current)
            return true
          }
          if (event.key === 'Enter' && items.length) {
            event.preventDefault()
            const item = items[Math.min(slashIdxRef.current, items.length - 1)]
            slashRef.current = null
            setSlash(null)
            applyRef.current?.(item)
            return true
          }
        }
        return false
      },
    },
    onUpdate: () => setDirty(true),
  }, [content])

  useEffect(() => {
    // contenido externo nuevo (post-guardado) → sincroniza si el usuario no tiene cambios pendientes
    if (editor && !dirty && (content || '') !== originalRef.current) {
      originalRef.current = content || ''
      editor.commands.setContent(toWiki(content || ''))
    }
  }, [content, editor])

  if (!editor) return <div style={{ padding: 20, color: 'var(--color-error)' }}>DEBUG: editor aún null — TipTap no montó</div>

  // headings para el índice — walk barato por render, sin hook (el early return de arriba prohíbe useMemo aquí)
  const headings = []
  editor.state.doc.descendants((node) => {
    if (/^heading[1-3]$/.test(node.type.name)) {
      const text = node.textContent.trim()
      if (text) headings.push({ level: Number(node.type.name.slice(-1)), text })
    }
  })

  const goto = (h) => {
    // ponytail: sin ids en el DOM — se busca el heading renderizado por texto (único en la práctica)
    const el = [...(bodyRef.current?.querySelectorAll('h1, h2, h3') || [])].find(x => (x.textContent || '').trim() === h.text)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  const applySlash = (item) => {
    const chain = editor.chain().focus()
    // borra el "/" del bloque vacío
    const { from } = editor.state.selection
    if (editor.state.doc.textBetween(Math.max(0, from - 1), from) === '') {
      chain.deleteRange({ from: from - 1, to: from })
    }
    item.cmd(chain).run()
    slashRef.current = null
    setSlash(null)
  }
  applyRef.current = applySlash // ponytail: handleKeyDown (closure estable) llama esta versión fresca

  const filtered = SLASH_ITEMS.filter(i => (slash?.query || '') === '' || i.label.toLowerCase().includes((slash?.query || '').toLowerCase()))

  // fase 4: guardar lanza el job en background y cierra — el Candado por archivo vive en la lista de Cerebro
  const save = () => {
    if (!onSaveEdit) return
    onSaveEdit(fromWiki(editor.storage.markdown.getMarkdown()))
    onClose()
  }

  const statusIcon = status ? (
    status.in_graph
      ? (status.stale
        ? <span key="stale" className="docreader-status docreader-status-stale" title="Modificado — el grafo está desactualizado"><span className="material-symbols-outlined">edit</span></span>
        : <span key="ok" className="docreader-status docreader-status-ok" title="En el cerebro — grafo al día"><span className="material-symbols-outlined">psychology</span></span>)
      : <span key="out" className="docreader-status docreader-status-out" title="Fuera del grafo — todavía no está en el cerebro"><span className="material-symbols-outlined">psychology</span></span>
  ) : null

  return (
    <div className="docreader-overlay" onClick={onClose}>
      <div className="docreader-panel" onClick={e => e.stopPropagation()}>
        <div className="docreader-header">
          <div className="docreader-title">
            <span className="material-symbols-outlined">description</span>
            <div className="docreader-title-text">
              <div className="docreader-title-name">{title}</div>
              {context && <div className="docreader-title-context">{context}</div>}
            </div>
            {statusIcon}
          </div>
          <div className="docreader-actions">
            <button className="docreader-menu-btn" onClick={() => setMenuOpen(o => !o)} title="Índice">
              <span className="material-symbols-outlined">menu</span>
            </button>
            {onSaveEdit && (
              <button className="chat-action-btn primary" onClick={save} disabled={!dirty}>
                <span className="material-symbols-outlined">save</span>{dirty ? 'Guardar' : 'Guardado'}
              </button>
            )}
            {actions.map((a, i) => <React.Fragment key={i}>{a}</React.Fragment>)}
            <button onClick={onClose} className="btn-app btn-app-secondary" style={{ width: 32, height: 32, padding: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>
        <div className={`docreader-body ${menuOpen ? 'docreader-menu-open' : ''}`}>
          {headings.length >= 3 && (
            <nav className="docreader-index">
              {headings.map((h, i) => (
                <button key={i} className={`docreader-idx-btn docreader-idx-${h.level}`} onClick={() => goto(h)}>{h.text}</button>
              ))}
            </nav>
          )}
          <div className="docreader-content" ref={bodyRef}>
            <div className="docreader-content-inner docreader-prose" onClick={() => { setMenuOpen(false); slashRef.current = null; setSlash(null) }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
        {slash && filtered.length > 0 && (
          <div className="docreader-slash" style={{ left: slash.x, top: slash.y }}>
            {filtered.map((item, i) => (
              <button key={item.label} className={`docreader-slash-item${i === slashIdx ? ' sel' : ''}`} onMouseDown={(e) => { e.preventDefault(); applySlash(item) }}>
                <span className="docreader-slash-label">{item.label}</span>
                <span className="docreader-slash-desc">{item.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
