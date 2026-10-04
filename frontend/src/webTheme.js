// ponytail: un tema = {primary, secondary?, background?}. Secundario/fondo opcionales — sin ellos, tokens.
// Dos almacenes: localStorage (este dispositivo) y agent-config.json (todos, vía /api/web/palettes).

const LS_PALETTES = 'cv-web-palettes'
const LS_ACTIVE = 'cv-web-active'
const LS_LOGO = 'cv-web-logo'
const LS_FAVICON = 'cv-web-favicon'

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}
// ponytail: exportada para que AjustesView sincronice el modo (claro/oscuro) al aplicar un tema de usuario
export function relLum(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
// ponytail: contraste WCAG — umbral práctico 3:1 para UI (botones/acentos), 4.5:1 sería para texto
export function contrast(a, b) {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
export function hue(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => c / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d === 0) return -1 // neutro (sin tono)
  let h
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) + 360) % 360
}
function hueDist(a, b) {
  const ha = hue(a), hb = hue(b)
  if (ha < 0 || hb < 0) return 360 // neutros combinan con todo
  const d = Math.abs(ha - hb)
  return Math.min(d, 360 - d)
}
// Regla del sistema: primario necesita >=3:1 con el fondo; secundario >=3:1 con fondo
// y tono a >=60 grados del primario (los análogos cercanos los cubre el automático).
export function primaryOk(primary, background) {
  return contrast(primary, background) >= 3
}
export function secondaryOk(secondary, primary, background) {
  return contrast(secondary, background) >= 3 && hueDist(secondary, primary) >= 60
}
export function onColor(hex) {
  return relLum(hex) > 0.35 ? '#0B1220' : '#FFFFFF'
}

export function applyPalette(pal) {
  // pal: {primary, secondary?, background?} — solo primary mantiene compatibilidad v4
  // ponytail: fondo sin primario aún (preview del editor) → usa el primario token actual
  const computed = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
  const primary = pal?.primary || (/^#[0-9a-fA-F]{6}$/.test(computed) ? computed : '#1E6E52')
  if (!pal || (!pal.primary && !pal.background)) return clearPalette()
  const secondary = pal.secondary || ''
  const bg = pal.background || ''
  // el fondo decide el modo: oscuro → data-theme dark (el texto se adapta), claro → light
  if (bg) document.documentElement.dataset.theme = relLum(bg) > 0.5 ? 'light' : 'dark'
  const style = document.getElementById('cv-palette') || (() => {
    const s = document.createElement('style'); s.id = 'cv-palette'; document.head.appendChild(s); return s
  })()
  const rgb = hexToRgb(primary).join(', ')
  // secundario: automático = derivado del primario si no se eligió uno explícito
  const sec = secondary || primary
  const secRgb = hexToRgb(sec).join(', ')
  // ponytail: superficies derivadas del fondo — en oscuro 96/92% hacia blanco (antes 72/80% = cajas
  // casi claras con texto claro = ilegibles); en claro, surface hacia blanco y container hacia negro
  const bgBlock = bg ? `
  --color-bg: ${bg};
  --color-surface: color-mix(in srgb, ${bg} 60%, white);
  --color-surface-container: color-mix(in srgb, ${bg} 93%, black);
  --color-surface-high: color-mix(in srgb, ${bg} 85%, black);` : ''
  const bgBlockDark = bg ? `
  --color-bg: ${bg};
  --color-surface: color-mix(in srgb, ${bg} 96%, white);
  --color-surface-container: color-mix(in srgb, ${bg} 90%, white);
  --color-surface-high: color-mix(in srgb, ${bg} 80%, white);` : ''
  style.textContent = `
:root {
  --color-primary: ${primary};
  --color-primary-container: ${sec};
  --color-secondary: ${sec};
  --color-on-primary: ${onColor(primary)};
  --color-primary-glow: rgba(${rgb}, 0.22);${bgBlock}
}
[data-theme="dark"] {
  --color-primary: color-mix(in srgb, ${primary} 75%, white);
  --color-primary-container: color-mix(in srgb, ${sec} 75%, white);
  --color-secondary: color-mix(in srgb, ${sec} 75%, white);
  --color-on-primary: #0B1220;
  --color-primary-glow: rgba(${secRgb}, 0.3);${bgBlockDark}
}`
}

export function clearPalette() {
  document.getElementById('cv-palette')?.remove()
}

export function localPalettes() {
  try { return JSON.parse(localStorage.getItem(LS_PALETTES)) || [] } catch { return [] }
}
export function saveLocalPalette(pal) {
  const list = localPalettes().filter(p => p.name !== pal.name)
  list.push(pal)
  localStorage.setItem(LS_PALETTES, JSON.stringify(list))
}
export function deleteLocalPalette(name) {
  localStorage.setItem(LS_PALETTES, JSON.stringify(localPalettes().filter(p => p.name !== name)))
}
export function localActive() {
  try { return JSON.parse(localStorage.getItem(LS_ACTIVE))?.name || '' } catch { return '' }
}
// ponytail: LS_ACTIVE guarda el tema completo (JSON) — así los predefinidos persisten sin duplicarlos en la lista
export function setLocalActive(pal) {
  if (pal) { localStorage.setItem(LS_ACTIVE, JSON.stringify(pal)); applyPalette(pal) }
  else { localStorage.removeItem(LS_ACTIVE); clearPalette() }
}
export function localActivePal() {
  try { return JSON.parse(localStorage.getItem(LS_ACTIVE)) || null } catch { return null }
}

// === Logo y favicon personalizados (por dispositivo, como los temas) ===
export function getWebLogo() { try { return localStorage.getItem(LS_LOGO) || '' } catch { return '' } }
export function setWebLogo(dataUrl) {
  if (dataUrl) localStorage.setItem(LS_LOGO, dataUrl)
  else localStorage.removeItem(LS_LOGO)
  window.dispatchEvent(new Event('cv-web-brand')) // BrandMark se re-leé
}
export function getWebFavicon() { try { return localStorage.getItem(LS_FAVICON) || '' } catch { return '' } }
export function setWebFavicon(dataUrl) {
  if (dataUrl) localStorage.setItem(LS_FAVICON, dataUrl)
  else localStorage.removeItem(LS_FAVICON)
}
export function applyWebFavicon() {
  let link = document.querySelector('link[rel="icon"]')
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  link.removeAttribute('type') // ponytail: dataURL png/jpeg no es svg+xml
  link.href = getWebFavicon() || '/vite.svg'
}
