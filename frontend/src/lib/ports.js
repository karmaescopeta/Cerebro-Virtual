// v1.5.4: los links a contenedores salen del .env del cerebro (vía /api/version),
// nunca de hardcodes — cada cerebro tiene sus puertos y son fijos.
let _cache = null
export async function getPorts() {
  if (_cache) return _cache
  try {
    const d = await (await fetch('/api/version')).json()
    _cache = d.ports || {}
  } catch { _cache = {} }
  return _cache
}
export async function containerUrl(name, fallbackPort) {
  const p = await getPorts()
  const port = p[name] || fallbackPort
  return `http://localhost:${port}`
}
