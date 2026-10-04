import React, { useState, useEffect, useRef } from 'react'
import SetupWizard from './SetupWizard'
import './app.css'
import Drawer from './components/layout/Drawer'
import Dock from './components/layout/Dock'
import TopRight from './components/layout/TopRight'
import DashboardView from './components/views/DashboardView'
import ChatView from './components/views/ChatView'
import CerebroView from './components/views/CerebroView'
import GrafoView from './components/views/GrafoView'
import ModelosView from './components/views/ModelosView'
import AjustesView from './components/views/AjustesView'
import ActualizacionesView from './components/views/ActualizacionesView'
import ExportPopup from './components/shared/ExportPopup'
import VersionBanner from './components/shared/VersionBanner'
import { getWebLogo, applyWebFavicon, applyPalette, localActivePal } from './webTheme.js'

// logo personalizado (localStorage) o icono psychology por defecto; aplica también el favicon
function BrandMark() {
  const [logo, setLogo] = useState(getWebLogo)
  useEffect(() => {
    applyWebFavicon()
    const h = () => setLogo(getWebLogo())
    window.addEventListener('cv-web-brand', h)
    return () => window.removeEventListener('cv-web-brand', h)
  }, [])
  return (
    <div className="brand-mark">
      {logo
        ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
        : <span className="material-symbols-outlined">psychology</span>}
    </div>
  )
}

function App() {
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [agentStarting, setAgentStarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [vaultInfo, setVaultInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('chat')  // ponytail: chat-first — la conversación es la portada
  const [drawerOpen, setDrawerOpen] = useState(true)  // ponytail: nav visible como el sidebar histórico
  // tema: preferencia del navegador (localStorage), claro por defecto
  const [theme, setTheme] = useState(() => localStorage.getItem('cv_theme') || 'dark')
  // ponytail: tema activo se restaura AL CARGAR (antes solo al entrar en Ajustes — al refrescar volvía al default)
  useEffect(() => {
    const pal = localActivePal()
    if (pal) applyPalette(pal)
    fetch('/api/web/palettes').then(r => r.json()).then(d => {
      if (d.active) {
        const p = (d.palettes || []).find(x => x.name === d.active)
        if (p) applyPalette(p)
      }
    }).catch(() => {})
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  // Chat
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatAttachedFile, setChatAttachedFile] = useState(null)
  const [chatUploading, setChatUploading] = useState(false)
  const [chatDragOver, setChatDragOver] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [chatSmart, setChatSmart] = useState(false)
  const [cerebroMode, setCerebroMode] = useState(false)
  const [internetMode, setInternetMode] = useState(false)
  const [investigationMode, setInvestigationMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState([])
  const [researchPanel, setResearchPanel] = useState(null) // ponytail: investigador v2 — null = cerrado
    const [researchHistory, setResearchHistory] = useState([]) // ponytail: investigaciones de esta conversación (para "Ver investigaciones")
    // fase 2 visor-md: toast global — procesos largos (investigar, editar, uploads) avisan sin bloquear
    const [toast, setToast] = useState(null)
    const toastTimer = useRef(null)
    function showToast(m) {
      setToast(m)
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 4000)
    }
    const fileInputRef = useRef(null)
    // fase 3: importaciones en curso (icono TopRight animado) + aviso de proceso terminado
    const [importJobs, setImportJobs] = useState(0)
    const [brainNotify, setBrainNotify] = useState(false)
    const [brainError, setBrainError] = useState(false) // fase investigador: bolita ROJA del matraz — guardado sin neuronas o fallido
    // fase 4: jobs del servidor (investigaciones/guardados) — sobreviven recargas; el poller alimenta el matraz y los avisos
    const [serverJobs, setServerJobs] = useState([])
    const seenJobsRef = useRef(new Set(JSON.parse(localStorage.getItem('cv-seen-jobs') || '[]')))
    const _saveSeenJobs = () => { try { localStorage.setItem('cv-seen-jobs', JSON.stringify([...seenJobsRef.current].slice(-100))) } catch {} }

    useEffect(() => {
      const iv = setInterval(async () => {
        try {
          const d = await (await fetch('/api/jobs')).json()
          setServerJobs(d.jobs || [])
        } catch {}
      }, 5000)
      return () => clearInterval(iv)
    }, [])

    // procesar jobs terminados (una sola vez por job): toast + resultado al panel/chat + bolita del matraz
    useEffect(() => {
      for (const j of serverJobs) {
        if (j.status === 'running' || seenJobsRef.current.has(j.id)) continue
        seenJobsRef.current.add(j.id)
        _saveSeenJobs()
        if (j.kind === 'investigate' && j.status === 'done') {
          const d = j.result || {}
          if (d.full_doc) {
            const id = Date.now()
            setResearchPanel(p => ({ ...(p || { open: false, view: 'crear', phase: 'questions', questions: [], answers: [], round: 0, level: 'intermedio', error: '', topic: j.topic || '' }), loading: false, result: d.full_doc, notify: !(p && p.open), activeId: id }))
            setResearchHistory(h => [...h.filter(x => x.id !== id), { id, topic: j.topic || 'Investigación', doc: d.full_doc, inBrain: false, brainPath: '' }])
            setChatMessages(p => [...p, { role: 'assistant', content: d.response || 'Investigación completada', full_doc: d.full_doc, context: d.context, _originalQuery: j.topic }])
          }
          setBrainNotify(true)
          showToast({ type: 'success', text: `Investigación lista${j.topic ? ': ' + j.topic.slice(0, 50) : ''}` })
        } else if (j.kind === 'save-brain' && j.status === 'done') {
          // fase investigador: 'Añadir al cerebro' terminó — toast + bolita (verde ok / roja sin neuronas)
          const r = j.result || {}
          setChatMessages(p => [...p, { role: 'assistant', content: `✅ **Guardado en el cerebro.**\n\n- Archivo: \`${r.path}\`\n- Wiki: \`${r.wiki_path}\`\n- Neuronas creadas: ${r.graph_updated ? '✓' : '✗ (falló tras 3 intentos)'}` }])
          if (r.path && r.content) {
            setChatMessages(p => p.map(m => m.full_doc === r.content ? { ...m, context: { ...(m.context || {}), brain_path: r.path } } : m))
            setResearchPanel(p => (p && p.result === r.content) ? { ...p, brainPath: r.path } : p)
          }
          loadPersistedResearch(); loadWikiGraph(); loadData()
          if (r.graph_updated) { setBrainNotify(true); setBrainError(false); showToast({ type: 'success', text: 'Guardado en el cerebro — neuronas creadas ✓' }) }
          else { setBrainNotify(false); setBrainError(true); showToast({ type: 'error', text: 'Guardado en el cerebro, pero las neuronas fallaron tras 3 intentos — prueba otra vez' }) }
        } else if (j.kind === 'save-doc' && j.status === 'done') {
          const r = j.result || {}
          // fase investigador: sincroniza chat/historial/panel con el contenido guardado (borrador o cerebro)
          if (r.old_content) {
            setChatMessages(p => p.map(m => m.full_doc === r.old_content ? { ...m, full_doc: r.new_content } : m))
            setResearchHistory(h => h.map(x => x.doc === r.old_content ? { ...x, doc: r.new_content } : x))
            setResearchPanel(p => (p && p.result === r.old_content) ? { ...p, result: r.new_content } : p)
          }
          if (r.draft) { setBrainNotify(false) } // guardado de borrador: local, sin bolita
          else {
            setBrainNotify(true)
            if (r.graph_updated === false) { setBrainNotify(false); setBrainError(true) } // edición sin neuronas → bolita roja
            else setBrainError(false)
          }
          showToast({ type: 'success', text: r.draft ? 'Borrador actualizado' : `Guardado${r.formatted ? ' (formateado por el investigador)' : ''}${r.graph_updated ? ' — neuronas actualizadas ✓' : ' — las neuronas fallaron tras 3 intentos'}` })
          loadWikiGraph(); loadData()
          if (r.draft) loadPersistedResearch()
        } else if (j.status === 'error') {
          setBrainNotify(true)
          if (j.kind !== 'investigate') setBrainError(true) // save-doc/save-brain fallidos → bolita roja
          showToast({ type: 'error', text: `${j.kind === 'investigate' ? 'Investigación' : 'Guardado'} falló: ${String(j.error || '').slice(0, 80)}` })
        }
      }
    }, [serverJobs])

  // IA mode (combo local/cloud)
  const [iaMode, setIaMode] = useState(null)      // ia-mode.json: {mode, localMode, cloudMode, ...}
  const [iaLocal, setIaLocal] = useState(false)   // toggle del chat (solo activo si mode=both)
  const [iaAviso, setIaAviso] = useState(false)   // modal aviso cerebro-cloud 1 vez

  // Agent keys
  const [agentKeys, setAgentKeys] = useState({ hermes: { configured: false, key: '' } })
  const [hermesKey, setHermesKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyMessage, setKeyMessage] = useState('')
  const [keyMessageType, setKeyMessageType] = useState('')

  // Agent edit
  const [editingAgent, setEditingAgent] = useState(false)
  const [editAgentName, setEditAgentName] = useState('')
  const [editPersonality, setEditPersonality] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  // ponytail: avatar del agente como data-URL en agent-config.json (endpoint /api/agent/avatar)
  const [agentAvatar, setAgentAvatar] = useState('')
  React.useEffect(() => {
    fetch('/api/agent/avatar').then(r => r.ok ? r.json() : null).then(d => { if (d?.avatar) setAgentAvatar(d.avatar) }).catch(() => {})
  }, [])
  const [editMessageType, setEditMessageType] = useState('')
  const [restarting, setRestarting] = useState(false)

  // System
  const [systemInfo, setSystemInfo] = useState(null)
  const [containers, setContainers] = useState(null)
  const [wikiGraph, setWikiGraph] = useState({ nodes: [], edges: [] })
  const [projects, setProjects] = useState([])
  const [updates, setUpdates] = useState(null)
  const [version, setVersion] = useState(null)

  // Cerebro
  const [cerebroSubtab, setCerebroSubtab] = useState('estructura')
  const [rawFiles, setRawFiles] = useState([])
  const [outputFiles, setOutputFiles] = useState([])
  const [cerebroSearch, setCerebroSearch] = useState('')
  const [cerebroSelected, setCerebroSelected] = useState({})
  const [cerebroDeleting, setCerebroDeleting] = useState(false)

  // Vault
  const [vaultMessage, setVaultMessage] = useState('')
  const [vaultMessageType, setVaultMessageType] = useState('')
  const [vaultImporting, setVaultImporting] = useState(false)
  const [showExportPopup, setShowExportPopup] = useState(false)
  const importFileRef = useRef(null)

  useEffect(() => { checkConfiguration() }, [])
  useEffect(() => { if (activeTab === 'cerebro') loadCerebroFiles() }, [activeTab])
  useEffect(() => { if (activeTab === 'chat' && isConfigured) loadSessions() }, [activeTab, isConfigured])
  useEffect(() => { if (activeTab === 'dashboard') loadProjects() }, [activeTab])
  // ponytail: cargar modo IA cuando el sistema está listo
  useEffect(() => { if (isConfigured) loadIaMode() }, [isConfigured])

  async function loadIaMode() {
    try {
      const d = await (await fetch('/api/ia/mode')).json()
      setIaMode(d)
      setIaLocal(d.mode === 'local')
    } catch {}
  }

  async function toggleIaLocal() {
    // ponytail: optimistic toggle + persistir en ia-mode.json (mode=both → toggle real;
    // mode=local/cloud → el backend ya clampea, persistir el flag para coherencia)
    const next = !iaLocal
    setIaLocal(next)
    try {
      const d = await (await fetch('/api/ia/mode', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: iaMode?.mode === 'both' ? 'both' : (next ? 'local' : 'cloud') }) })).json()
      setIaMode(d)
    } catch {}
  }

  async function markIaAvisoVisto() {
    setIaAviso(false)
    try { await fetch('/api/ia/aviso', { method: 'POST' }) } catch {}
  }

  // === Data loading ===
  async function checkConfiguration() {
    try {
      const res = await fetch('/api/init/status')
      const data = await res.json()
      setIsConfigured(data.configured)
      if (data.configured) {
        await startAgent()
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph(), loadProjects(), loadUpdates(), loadVersion()])
      }
      setLoading(false)
    } catch { setLoading(false) }
  }

  async function loadData() {
    try {
      const [h, v] = await Promise.all([fetch('/api/health'), fetch('/api/vault/status')])
      setStatus(await h.json())
      setVaultInfo(await v.json())
    } catch {}
  }

  async function loadAgentKeys() {
    try {
      const data = await (await fetch('/api/agents/keys')).json()
      const m = {}
      ;(data.agents || []).forEach(a => { m[a.name] = { configured: a.configured, key: '' } })
      setAgentKeys(m)
    } catch {}
  }

  async function loadAgentConfig() {
    try {
      const res = await fetch('/api/agent/config')
      if (res.ok) { const d = await res.json(); setEditAgentName(d.agentName || 'Hermes'); setEditPersonality(d.personality || '') }
    } catch {}
  }

  async function loadSystemInfo() {
    try { const res = await fetch('/api/system/info'); if (res.ok) setSystemInfo(await res.json()) } catch {}
  }

  async function loadContainersStatus() {
    try { const res = await fetch('/api/containers/status'); if (res.ok) setContainers(await res.json()) } catch {}
  }

  async function loadWikiGraph() {
    try { const res = await fetch('/api/wiki/graph'); if (res.ok) setWikiGraph(await res.json()) } catch {}
  }

  async function loadProjects() {
    try { const res = await fetch('/api/projects'); if (res.ok) setProjects((await res.json()).projects || []) } catch {}
  }

  async function loadUpdates() {
    try { const res = await fetch('/api/updates/check'); if (res.ok) setUpdates(await res.json()) } catch {}
  }

  async function loadVersion() {
    try { const d = await (await fetch('/api/version')).json(); setVersion(d.current && d.current !== 'unknown' ? { current: d.current, githubRepo: d.githubRepo } : null) } catch {}
  }

  async function loadCerebroFiles() {
    try {
      const [r, o] = await Promise.all([fetch('/api/vault/raw'), fetch('/api/vault/outputs')])
      if (r.ok) setRawFiles((await r.json()).files || [])
      if (o.ok) setOutputFiles((await o.json()).files || [])
    } catch {}
  }

  // === Agent ===
  async function startAgent() {
    setAgentStarting(true)
    try {
      const d = await (await fetch('/api/agent/start', { method: 'POST' })).json()
      if (!d.success) { alert('Error: ' + d.message); return false }
      return true
    } catch { alert('Error al iniciar agente'); return false }
    finally { setAgentStarting(false) }
  }

  async function handleWizardComplete() {
    setAgentStarting(true)
    try {
      if (await startAgent()) {
        setIsConfigured(true)
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph(), loadProjects(), loadUpdates(), loadVersion()])
                fetch('/api/agent/avatar').then(r => r.ok ? r.json() : null).then(d => { if (d?.avatar) setAgentAvatar(d.avatar) }).catch(() => {})
              }
            } finally { setAgentStarting(false) }
  }

  // === Chat ===
  async function handleUploadChatFile(file) {
    // ponytail: sin filtro de extensiones — aceptar cualquier archivo
    setChatUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/upload?project=individual', { method: 'POST', body: fd })).json()
      if (d.success || d.path || d.name) {
        const fn = d.name || file.name
        setChatAttachedFile({ name: fn, path: `raw/chat/${fn}`, preview_type: d.preview_type || 'document', wiki_path: d.wiki_path, wiki_pending: d.wiki_pending, size: d.file_size, local_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
        if (d.wiki_pending) { setChatMessages(p => [...p, { role: 'assistant', content: `⏳ **${fn} en cola de procesamiento.** La wiki aparecerá cuando esté lista (mira la pestaña Cerebro en unos segundos).` }]); }
        else if (d.wiki_path) { setChatMessages(p => [...p, { role: 'assistant', content: `✅ ${fn} procesado → ${d.wiki_path}` }]); await loadData(); await loadWikiGraph() }
      } else { alert('Error: ' + (d.message || 'desconocido')) }
    } catch { alert('Error al subir') } finally { setChatUploading(false) }
  }

  // === Chat Sessions ===
  async function loadSessions() {
    try {
      const res = await fetch('/api/chat/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
      // ponytail: cargar la sesión lastActive o crear una nueva
      const active = (data.sessions || []).find(s => s.lastActive)
      if (active) {
        await switchToSession(active.id)
      } else if ((data.sessions || []).length === 0) {
        await createNewSession()
      } else {
        await switchToSession(data.sessions[0].id)
      }
    } catch {}
  }

  async function switchToSession(id) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`)
      const data = await res.json()
      setActiveSessionId(id)
      setChatMessages(data.messages || [])
      // marcar como activa en backend
      await fetch(`/api/chat/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastActive: true }) })
      // refrescar lista
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  async function createNewSession() {
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST' })
      const data = await res.json()
      setActiveSessionId(data.id)
      setChatMessages([])
      setInvestigationMode(false)
      setSelectedMessages([])
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  async function deleteSession(id) {
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
      const listRes = await fetch('/api/chat/sessions')
      const list = (await listRes.json()).sessions || []
      setSessions(list)
      if (activeSessionId === id) {
        if (list.length > 0) {
          await switchToSession(list[0].id)
        } else {
          await createNewSession()
        }
      }
    } catch {}
  }

  async function renameSession(id, title) {
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  function computeMode() {
    if (cerebroMode) return internetMode ? 'cerebro+internet' : 'cerebro'
    if (chatSmart) return 'smart'
    return 'default'
  }

  async function handleSendChat() {
    if (!chatMessage.trim() && !chatAttachedFile) return
    setChatLoading(true)
    let msg = chatMessage
    if (chatAttachedFile) {
      const note = `El usuario ha subido el archivo «${chatAttachedFile.name}» que ya está guardado en raw/individual/${chatAttachedFile.name}. Procésalo si es necesario.`
      msg = msg ? `${msg}\n\n${note}` : note
    }
    const mode = computeMode()
    const sendLocal = iaMode?.mode === 'local' || (iaMode?.mode === 'both' && iaLocal)
    // ponytail: optimistic UI — mensaje aparece inmediatamente, input se limpia antes del fetch
    setChatMessages(p => [...p, { role: 'user', content: msg, attachment: chatAttachedFile }])
    setChatMessage(''); setChatAttachedFile(null)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, session_id: activeSessionId, mode, local: sendLocal }) })
      let txt = '', ctx = null
      if (!res.ok) { const e = await res.json().catch(() => ({})); txt = 'Error: ' + (e.detail || e.message || `HTTP ${res.status}`) }
      else { const d = await res.json(); txt = d.response || 'Sin respuesta'; ctx = d.context || null }
      setChatMessages(p => [...p, { role: 'assistant', content: txt, context: ctx, _originalQuery: msg }])
      // ponytail: aviso informativo 1 vez — 1ª respuesta cerebro-cloud (no error, no timeout)
      const wentCloudCerebro = mode.startsWith('cerebro') && ctx && !ctx.local && !ctx.error
      if (wentCloudCerebro) {
        try {
          const a = await (await fetch('/api/ia/aviso')).json()
          if (!a.cerebroAvisoVisto) setIaAviso(true)
        } catch {}
      }
      // refrescar lista de sesiones (título auto-actualizado)
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {
      setChatMessages(p => [...p, { role: 'assistant', content: 'Error al conectar con ' + (editAgentName || 'Hermes') }])
    } finally { setChatLoading(false) }
  }

  // ponytail: investigador v2 — Investigar abre el panel directamente; selección de mensajes DESMARCADA por defecto
        function startInvestigation() {
          setInvestigationMode(false); setSelectedMessages([])
          const typed = chatMessage.trim()
          if (typed) setChatMessage('')
          setResearchPanel({ open: true, view: 'crear', phase: 'confirm', topic: typed, messages: [], questions: [], answers: [], round: 0, level: 'intermedio', result: null, loading: false, error: '', notify: false, generatingTopic: false, activeId: null })
        }

      function cancelInvestigation() {
        setInvestigationMode(false); setSelectedMessages([])
        setResearchPanel(p => p ? { ...p, open: false } : null)
      }

    // Enter/texto libre → panel con ese tema (modo directo)
          function openResearchPanel(selectedMsgs) {
            const msgs = selectedMsgs.map(m => typeof m === 'number' ? chatMessages[m] : m).filter(m => m)
            if (!msgs.length) return
            setInvestigationMode(true); setSelectedMessages([])
            setResearchPanel({ open: true, view: 'crear', phase: 'confirm', topic: msgs.map(m => m.content).join('\n'), messages: msgs.map((m, i) => ({ ...m, idx: i })), questions: [], answers: [], round: 0, level: 'intermedio', result: null, loading: false, error: '', notify: false, generatingTopic: false, activeId: null })
          }

          // ponytail: pestañas del panel — Crear investigación / Ver investigaciones (de esta conversación)
          function setResearchView(view) {
          setResearchPanel(p => p ? { ...p, view, open: true } : p)
          if (view === 'historia') loadPersistedResearch()
        }
        // fase 2 visor-md: "Ver investigaciones" lee de las sesiones (los mensajes is_document del backend) — sobrevive recargas
        async function loadPersistedResearch() {
          try {
            const { sessions } = await (await fetch('/api/chat/sessions')).json()
            const docs = []
            for (const s of (sessions || [])) {
              const d = await (await fetch(`/api/chat/sessions/${s.id}`)).json()
              for (const m of (d.messages || [])) {
                if (m.context && m.context.is_document && m.full_doc) {
                  docs.push({ id: `${s.id}-${m.timestamp}`, topic: (m.full_doc.match(/^#\s+(.+)$/m) || [])[1] || s.title, doc: m.full_doc, ts: m.timestamp,
                    inBrain: !!m.context.brain_path, brainPath: m.context.brain_path || '' })
                }
              }
            }
            docs.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
            // ponytail: dedup también dentro de docs — deepen crea un mensaje por versión, solo manda la más reciente
            const seen = new Set()
            const uniq = docs.filter(x => { const k = x.doc.slice(0, 200); if (seen.has(k)) return false; seen.add(k); return true })
            setResearchHistory(h => {
              const seen2 = new Set(uniq.map(x => x.doc.slice(0, 200)))
              return [...uniq, ...h.filter(x => !seen2.has(x.doc.slice(0, 200)))]
            })
          } catch {}
        }

          function openHistoryDoc(item) {
            setResearchPanel(p => p ? { ...p, view: 'crear', result: item.doc, topic: item.topic, activeId: item.id, brainPath: item.brainPath || '', phase: 'questions', open: true, notify: false, loading: false, error: '' } : p)
          }

          // ponytail: Nueva investigación — panel de inicio en blanco (conserva el nivel elegido)
          function newResearch() {
            setResearchPanel(p => ({ open: true, view: 'crear', phase: 'confirm', topic: '', messages: [], questions: [], answers: [], round: 0, level: p?.level || 'intermedio', result: null, loading: false, error: '', notify: false, generatingTopic: false, activeId: null }))
          }

    // ponytail: los mensajes seleccionados (checkboxes) se escriben solos en el textarea del panel (contexto del investigador)
        useEffect(() => {
          setResearchPanel(p => {
            if (!p || p.phase !== 'confirm' || !selectedMessages.length) return p
            // ponytail: índices en orden del chat + idx en cada mensaje — el panel lista cada selección
            const msgs = selectedMessages.slice().sort((a, b) => a - b)
              .map(i => chatMessages[i] ? { ...chatMessages[i], idx: i } : null).filter(Boolean)
            if (!msgs.length) return p
            return { ...p, messages: msgs, topic: msgs.map(m => m.content).join('\n') }
          })
        }, [selectedMessages])

        // ponytail: seleccionar mensajes cierra el panel (para marcar en el chat); al soltar, el panel vuelve
        function toggleSelectMessages() {
          if (investigationMode) {
            setInvestigationMode(false)
            setResearchPanel(p => p ? { ...p, open: true } : p)
          } else {
            setInvestigationMode(true)
            setResearchPanel(p => p ? { ...p, open: false } : null)
          }
        }

    // ponytail: "Seleccionar tema" — el modelo destila el tema a partir de los mensajes seleccionados
    async function generateResearchTopic() {
      const p = researchPanel
      if (!p?.messages?.length) return
      setResearchPanel(prev => ({ ...prev, generatingTopic: true, error: '' }))
      try {
        const res = await fetch('/api/chat/investigate/topic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: p.messages }) })
        const d = await res.json()
        if (!res.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Error del modelo')
        setResearchPanel(prev => ({ ...prev, generatingTopic: false, topic: d.topic }))
      } catch (e) {
        setResearchPanel(prev => ({ ...prev, generatingTopic: false, error: e.message }))
      }
    }

        // ponytail: confirmación de tema antes del 1er cuestionario — el usuario corrige lo que el modelo malinterpretó
        function startResearch(finalTopic, mode) {
          setResearchPanel(p => ({ ...p, topic: finalTopic, phase: 'questions' }))
          if (mode === 'doc') fetchResearchDoc([], finalTopic)
          else fetchResearchQuestions([], finalTopic)
        }

        // ponytail: pestañita derecha — reabrir panel cerrado (sin destruir la investigación) + punto de notificación
        function openResearch() { setResearchPanel(p => p ? { ...p, open: true, notify: false } : p) }
        function dismissResearch() { setResearchPanel(null) }

  async function fetchResearchQuestions(newAnswers, topicOverride) {
      const p = researchPanel
      if (!p) return
      const topic = topicOverride || p.topic
      const answers = [...(p.answers || []), ...(newAnswers || [])]
      setResearchPanel(prev => ({ ...prev, loading: true, loadingText: 'Generando preguntas…', error: '' }))
      try {
        const res = await fetch('/api/chat/investigate/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, messages: p.messages, answers, round: p.round, session_id: activeSessionId }) })
        const d = await res.json()
        if (!res.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Error del modelo')
        setResearchPanel(prev => ({ ...prev, loading: false, questions: d.questions, round: d.round, answers, notify: !prev.open }))
      } catch (e) {
        setResearchPanel(prev => ({ ...prev, loading: false, error: e.message }))
      }
    }

    async function fetchResearchDoc(newAnswers, topicOverride) {
      const p = researchPanel
      if (!p) return
      const topic = topicOverride || p.topic
      const answers = [...(p.answers || []), ...(newAnswers || [])]
      setResearchPanel(prev => ({ ...prev, loading: true, loadingText: 'Generando documento…', error: '' }))
      try {
        // fase 4: job en background — sobrevive recargas; el poller de /api/jobs completa el panel y avisa
        const res = await fetch('/api/jobs/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: p.messages, topic, level: p.level, answers, session_id: activeSessionId }) })
        const d = await res.json()
        if (!res.ok || !d.job_id) throw new Error('No se pudo lanzar la investigación')
      } catch (e) {
        setResearchPanel(prev => ({ ...prev, loading: false, error: e.message }))
        showToast({ type: 'error', text: `Investigación fallida: ${e.message}` })
      }
    }

  async function deepenResearchDoc(subtema) {
    const p = researchPanel
    if (!p?.result || !subtema) return
    setResearchPanel(prev => ({ ...prev, loading: true, loadingText: 'Añadiendo sección…', error: '' }))
    try {
      const res = await fetch('/api/chat/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deepen: { doc: p.result, subtema }, topic: subtema, session_id: activeSessionId }) })
      const d = await res.json()
      if (d.context && d.context.error) throw new Error(d.response || 'Error')
      if (!d.full_doc) throw new Error(d.response || 'Sin documento')
            setResearchPanel(prev => ({ ...prev, loading: false, result: d.full_doc, notify: !prev.open }))
            setResearchHistory(h => h.map(x => x.id === p.activeId ? { ...x, doc: d.full_doc } : x))
                } catch (e) {
                  setResearchPanel(prev => ({ ...prev, loading: false, error: e.message }))
                }
              }

              // ponytail: guardar output en el cerebro
              // fase investigador: 'Añadir al cerebro' = job en background (graphify ~45s) — matraz anima,
              // popup cierra al instante; el poller completa toast + bolita + mensaje de chat al terminar
              async function handleSaveOutput(content, projectId, name, description) {
    try {
      const res = await fetch('/api/jobs/save-brain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, project_id: projectId, name, description, session_id: activeSessionId }) })
      const d = await res.json()
      if (!res.ok || !d.job_id) throw new Error(d.detail || 'No se pudo lanzar el guardado')
    } catch (e) {
      showToast({ type: 'error', text: `Guardado falló: ${e.message}` })
    }
  }

  // === Cerebro ===
    async function handleCerebroDelete() {
      // ponytail: keys = "estructura|raw|path" o "raw|path" o "outputs|path"
      const items = Object.entries(cerebroSelected).filter(([, v]) => v).map(([k]) => {
        const parts = k.split('|')
        // si primer parte es 'estructura', la segunda es la category real
        const category = parts[0] === 'estructura' ? parts[1] : parts[0]
        const path = parts[0] === 'estructura' ? parts.slice(2).join('|') : parts.slice(1).join('|')
        return { category, path }
      })
      if (!items.length) return
      if (!confirm(`¿Eliminar ${items.length} archivo(s)?`)) return
      setCerebroDeleting(true)
      try {
        const d = await (await fetch('/api/vault/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) })).json()
        if (d.errors?.length) alert('Errores: ' + d.errors.map(e => e.path).join(', '))
        setCerebroSelected({}); await loadCerebroFiles(); await loadWikiGraph(); await loadProjects()
      } catch {} finally { setCerebroDeleting(false) }
    }

  // === Settings handlers ===
  async function handleSaveHermesKey() {
    if (!hermesKey.trim()) return
    setKeySaving(true); setKeyMessage('')
    try {
      const d = await (await fetch('/api/agents/hermes/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: hermesKey.trim() }) })).json()
      if (d.success) { setKeyMessage('✅ Guardada'); setKeyMessageType('success'); setHermesKey(''); await loadAgentKeys(); await loadData() }
      else { setKeyMessage('❌ ' + (d.message || '')); setKeyMessageType('error') }
    } catch { setKeyMessage('❌ Error'); setKeyMessageType('error') } finally { setKeySaving(false) }
  }

  async function handleDeleteHermesKey() {
    if (!confirm('¿Eliminar API key?')) return
    setKeySaving(true)
    try {
      const d = await (await fetch('/api/agents/hermes/key', { method: 'DELETE' })).json()
      if (d.success) { setKeyMessage('✅ Eliminada'); setKeyMessageType('success'); await loadAgentKeys(); await loadData() }
      else { setKeyMessage('❌ ' + (d.message || '')); setKeyMessageType('error') }
    } catch { setKeyMessage('❌ Error'); setKeyMessageType('error') } finally { setKeySaving(false) }
  }

  async function handleSaveAgentEdit() {
    setEditSaving(true); setEditMessage('')
    try {
      const d = await (await fetch('/api/agent/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentName: editAgentName || 'Hermes', personality: editPersonality || '' }) })).json()
      if (d.success) { setEditMessage('✅ Actualizado'); setEditMessageType('success'); setEditingAgent(false); await loadAgentConfig() }
      else { setEditMessage('❌ ' + (d.message || '')); setEditMessageType('error') }
    } catch { setEditMessage('❌ Error'); setEditMessageType('error') } finally { setEditSaving(false) }
  }

  async function handleRestartAgent() {
    if (!confirm('¿Reiniciar agente?')) return
    setRestarting(true)
    try { const d = await (await fetch('/api/agent/restart', { method: 'POST' })).json(); alert(d.success ? '✅ ' + d.message : '❌ ' + d.message) }
    catch { alert('❌ Error') } finally { setRestarting(false) }
  }

  async function handleResetConfig() {
    if (!confirm('⚠️ Esto borrará la configuración. Tus notas NO se pierden.')) return
    if (!confirm('¿Confirmar?')) return
    try { await fetch('/api/init/reset', { method: 'DELETE' }); window.location.reload() } catch { alert('Error') }
  }

  async function handleExportVault(name) {
    setVaultMessage('⏳ Exportando...'); setVaultMessageType('info')
    try {
      const blob = await (await fetch('/api/vault/export')).blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${name}.tar.gz`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setVaultMessage('✅ Exportado'); setVaultMessageType('success')
      setTimeout(() => setShowExportPopup(false), 1000)
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') }
  }

  async function handleImportVault(file) {
    if (!confirm('⚠️ Importar reemplazará datos actuales.')) return
    setVaultImporting(true); setVaultMessage('⏳ Importando...'); setVaultMessageType('info')
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/import', { method: 'POST', body: fd })).json()
      if (d.success) {
        setVaultMessage('✅ Importado. Recargando...'); setVaultMessageType('success')
        alert('✅ Importación correcta.\n\nLa página se recargará para cargar todos los datos (grafos, wiki, proyectos).')
        setTimeout(() => window.location.reload(), 500)
      }
      else { setVaultMessage('❌ ' + (d.message || '')); setVaultMessageType('error') }
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') } finally { setVaultImporting(false) }
  }

  // === Drag-drop ===
  const handleChatDragOver = (e) => { e.preventDefault(); setChatDragOver(true) }
  const handleChatDragLeave = (e) => { e.preventDefault(); setChatDragOver(false) }
  const handleChatDrop = (e) => { e.preventDefault(); setChatDragOver(false); if (e.dataTransfer.files?.length) { Array.from(e.dataTransfer.files).forEach(f => handleUploadChatFile(f)) } }

  // === Render ===
  if (agentStarting) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Iniciando el agente... Esto puede tomar unos minutos.</p>
      </div>
    )
  }

  if (!loading && !isConfigured) return <SetupWizard onComplete={handleWizardComplete} />

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando Cerebro Virtual...</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <VersionBanner />
      {/* ponytail: barra superior sólida — título/botones flotan sobre ella, el contenido pasa por debajo */}
      <div className="topbar" />
      <div className="brand-row">
        <button className="nav-toggle" title={drawerOpen ? 'Esconder menú' : 'Sacar menú'} aria-label={drawerOpen ? 'Esconder menú' : 'Sacar menú'} onClick={() => setDrawerOpen(v => !v)}>
          <span className="material-symbols-outlined">{drawerOpen ? 'chevron_left' : 'chevron_right'}</span>
        </button>
        <BrandMark />
        <div className="brand-name">Cerebro</div>
      </div>
      <TopRight updates={updates}
              researchRunning={serverJobs.some(j => j.status === 'running') || !!researchPanel?.loading || importJobs > 0}
              researchBadge={brainNotify && !(serverJobs.some(j => j.status === 'running') || researchPanel?.loading || importJobs > 0)}
              researchBadgeError={brainError && !(serverJobs.some(j => j.status === 'running') || researchPanel?.loading || importJobs > 0)}
              onOpenResearch={() => {
                setActiveTab('chat')
                setBrainNotify(false)
                setBrainError(false)
                // jobs vistos: la bolita del matraz se despeja al abrir el panel
                for (const j of serverJobs) seenJobsRef.current.add(j.id)
                _saveSeenJobs()
                // fase investigador: el matraz abre en "Ver investigaciones" por defecto
                setResearchPanel(p => p
                  ? { ...p, open: true, view: 'historia', notify: false }
                  : { open: true, view: 'historia', phase: 'confirm', topic: '', messages: [], questions: [], answers: [], round: 0, level: 'intermedio', result: null, loading: false, error: '', notify: false, generatingTopic: false, activeId: null, brainPath: '' })
                loadPersistedResearch()
              }} />
      {/* ponytail: título de página en la barra superior — una sola fuente para todas las tabs */}
      <div className="topbar-title">{activeTab === 'chat' ? (<span>{agentAvatar && <img src={agentAvatar} alt="" style={{ height: 24, width: 24, borderRadius: '50%', objectFit: 'cover', verticalAlign: '-6px', marginRight: 8, pointerEvents: 'auto' }} />}{editAgentName || 'Hermes'}</span>) : ({ dashboard: 'Panel general', cerebro: 'Cerebro', graph: 'Grafo de Conocimiento', modelos: 'Modelos', updates: 'Actualizaciones', settings: 'Ajustes' })[activeTab]}</div>
            <main className={`app-main ${drawerOpen ? 'with-drawer' : ''}`}>
        {activeTab === 'dashboard' && <DashboardView vaultInfo={vaultInfo} systemInfo={systemInfo} containers={containers} editAgentName={editAgentName} projects={projects} onTabChange={setActiveTab} />}
        {activeTab === 'chat' && (
          <ChatView editAgentName={editAgentName} chatMessages={chatMessages} chatMessage={chatMessage} chatLoading={chatLoading}
            chatUploading={chatUploading} chatAttachedFile={chatAttachedFile} chatDragOver={chatDragOver}
            setChatMessage={setChatMessage} setChatAttachedFile={setChatAttachedFile}
            onSend={handleSendChat} onUploadFile={handleUploadChatFile}
            onDragOver={handleChatDragOver} onDragLeave={handleChatDragLeave} onDrop={handleChatDrop} fileInputRef={fileInputRef}
            onRefreshGraph={loadWikiGraph} onReloadProjects={loadProjects} projects={projects}
            onInvestigate={openResearchPanel} onSaveOutput={handleSaveOutput}
            brainUpdating={serverJobs.some(j => j.status === 'running' && (j.kind === 'save-doc' || j.kind === 'save-brain'))}
            researchPanel={researchPanel}
            onCloseResearch={() => setResearchPanel(p => p ? { ...p, open: false } : null)}
                        onFetchResearchQuestions={fetchResearchQuestions}
                        onCreateResearch={fetchResearchDoc}
                        onDeepenResearch={deepenResearchDoc}
                        onLevelResearch={(level) => setResearchPanel(p => ({ ...p, level }))}
                        onConfirmTopic={startResearch}
                                                onGenerateTopic={generateResearchTopic}
                                                onToggleSelectMessages={toggleSelectMessages}
                                                researchHistory={researchHistory}
                                                onSetResearchView={setResearchView}
                                                onOpenHistoryDoc={openHistoryDoc}
                                                onNewResearch={newResearch}
                                                onOpenInvestigation={startInvestigation}
                                    onCancelInvestigation={cancelInvestigation}
                                    onOpenResearch={openResearch}
                                    onDismissResearch={dismissResearch}
                                    activeSessionId={activeSessionId} sessions={sessions}
            onNewSession={createNewSession} onSwitchSession={switchToSession}
            onDeleteSession={deleteSession} onRenameSession={renameSession}
            chatSmart={chatSmart} setChatSmart={setChatSmart}
            cerebroMode={cerebroMode} setCerebroMode={setCerebroMode}
            internetMode={internetMode} setInternetMode={setInternetMode}
            investigationMode={investigationMode} setInvestigationMode={setInvestigationMode}
            selectedMessages={selectedMessages} setSelectedMessages={setSelectedMessages}
            iaMode={iaMode} iaLocal={iaLocal} onToggleIaLocal={toggleIaLocal} toast={showToast} />
                    )}
        {activeTab === 'cerebro' && (
          <CerebroView subtab={cerebroSubtab} setSubtab={setCerebroSubtab} rawFiles={rawFiles} outputFiles={outputFiles}
                      search={cerebroSearch} setSearch={setCerebroSearch} selected={cerebroSelected} setSelected={setCerebroSelected}
                      onDelete={handleCerebroDelete} deleting={cerebroDeleting} onReloadRaw={loadCerebroFiles} onRefreshGraph={loadWikiGraph} onReloadProjects={loadProjects} toast={showToast}
                      updatingPaths={serverJobs.filter(j => j.status === 'running' && j.kind === 'save-doc' && j.path).map(j => j.path)}
                      onJobStart={() => setImportJobs(j => j + 1)} onJobEnd={() => { setImportJobs(j => Math.max(0, j - 1)); setBrainNotify(true) }} />
        )}
        {activeTab === 'graph' && <GrafoView nodes={wikiGraph.nodes || []} edges={wikiGraph.edges || []} refreshKey={wikiGraph} projects={projects} />}
        {activeTab === 'modelos' && <ModelosView />}
        {activeTab === 'updates' && <ActualizacionesView />}
        {activeTab === 'settings' && (
          <AjustesView editAgentName={editAgentName} editPersonality={editPersonality} editingAgent={editingAgent}
            editSaving={editSaving} editMessage={editMessage} editMessageType={editMessageType} restarting={restarting}
            hermesKey={hermesKey} setHermesKey={setHermesKey} keySaving={keySaving} keyMessage={keyMessage} keyMessageType={keyMessageType}
            agentKeys={agentKeys} systemInfo={systemInfo} status={status} vaultMessage={vaultMessage} vaultMessageType={vaultMessageType} vaultImporting={vaultImporting}
            onEdit={() => setEditingAgent(true)} onCancelEdit={() => { setEditingAgent(false); loadAgentConfig() }}
            onSaveEdit={handleSaveAgentEdit} setEditAgentName={setEditAgentName} setEditPersonality={setEditPersonality}
            onRestart={handleRestartAgent} onSaveKey={handleSaveHermesKey} onDeleteKey={handleDeleteHermesKey}
            onExport={() => { setVaultMessage(''); setShowExportPopup(true) }} onImport={handleImportVault} onReset={handleResetConfig} onTabChange={setActiveTab} avatarUrl={agentAvatar} onAvatarChange={setAgentAvatar}
            theme={theme} onSetTheme={(t) => { setTheme(t); localStorage.setItem('cv_theme', t) }} />
        )}
        {showExportPopup && <ExportPopup onClose={() => setShowExportPopup(false)} onExport={handleExportVault} vaultMessage={vaultMessage} vaultMessageType={vaultMessageType} />}
        {/* ponytail: aviso informativo 1x — cerebro por cloud → recomendar modelo local (privacidad por capas) */}
        {iaAviso && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={markIaAvisoVisto}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-lg)', maxWidth: 480, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span className="material-symbols-outlined">cloud</span> Modo Cerebro por cloud
              </h3>
              <p style={{ lineHeight: 1.6, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Estás consultando tu <strong>cerebro (documentos privados)</strong> a través de un proveedor cloud.
                Para máxima privacidad, instala un <strong>modelo local potente</strong> y activa el modo Local:
                tus documentos nunca salen de tu máquina.
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
                💼 Para empresas: el modo 100% local mantiene los datos dentro de la organización.
                Configúralo en <strong>Modelos</strong> (pestaña IA Local).
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                <button className="btn-app btn-app-primary" onClick={markIaAvisoVisto}>Entendido</button>
              </div>
            </div>
          </div>
        )}
      </main>
            <Drawer open={drawerOpen} activeTab={activeTab} onTabChange={setActiveTab} agentName={editAgentName} />
            <Dock activeTab={activeTab} onTabChange={setActiveTab} agentName={editAgentName} />
            {/* fase 2 visor-md: toast global — procesos por detrás (investigar, editar, uploads) avisan aquí */}
            {toast && (
              <div className={`app-toast app-toast-${toast.type || 'info'}`} onClick={() => setToast(null)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'warning' : 'info'}
                </span>
                {toast.text}
              </div>
            )}
          </div>
        )
      }

export default App