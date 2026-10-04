// fase 4 visor-md: los guardados son JOBS del backend — diff + formato Graphify + grafo corren en el
// servidor y sobreviven recargas del navegador. El poller de /api/jobs en App avisa al terminar.
export async function startSaveJob({ path, oldContent, newContent, name, sessionId }) {
  const res = await fetch('/api/jobs/save-doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path || '', old_content: oldContent || '', new_content: newContent, name: name || '', session_id: sessionId || '' }) })
  if (!res.ok) throw new Error('No se pudo lanzar el guardado')
  return res.json() // { job_id }
}
