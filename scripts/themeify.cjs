// One-off codemod: replaces hardcoded theme-specific colors in JSX inline styles with CSS tokens.
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', 'src')
const SKIP = /(Print|PackingSlip|\.old\.|OLD|Old|Naryad(Print|Modal)|Invoice|Ttn)/i

const BG = {
  '#000': 'black', '#000000': 'black',
  '#050505': 'inset', '#0a0a0a': 'inset', '#0d0d0d': 'inset', '#0f0f0f': 'inset',
  '#09090b': 'inset', '#0c0c0f': 'inset', '#0e0e12': 'inset', '#0f0f14': 'inset', '#111': '1', '#111111': '1', '#121212': '1', '#141414': '1',
  '#121216': '2', '#14141a': '2', '#16161d': '2', '#18181b': '2', '#161616': '2', '#181818': '2', '#1a1a1a': '2',
  '#222': '3', '#222222': '3',
}
const bgMap = Object.fromEntries(Object.entries(BG).map(([k, v]) => [k, `var(--surface-${v})`]))
const TXT = {
  '#fff': 'strong', '#ffffff': 'strong', 'white': 'strong',
  '#f0f0f0': 'soft', '#eee': 'soft', '#e0e0e0': 'soft', '#ddd': 'soft', '#ccc': 'soft', '#bbb': 'soft',
  '#aaa': 'muted', '#999': 'muted', '#888': 'muted',
  '#666': 'dim', '#555': 'dim',
}
const txtMap = Object.fromEntries(Object.entries(TXT).map(([k, v]) => [k, `var(--text-${v})`]))
const BORDER_HEX = { '#222': 1, '#2a2a2a': 1, '#333': 1, '#1a1a1a': 1, '#1f1f1f': 1, '#262626': 1, '#2a2a2e': 1 }

function enclosing(text, idx) {
  let d = 0, s = idx
  while (s > 0) { s--; const c = text[s]; if (c === '}') d++; else if (c === '{') { if (d === 0) break; d-- } }
  let e = idx; d = 0
  while (e < text.length) { const c = text[e]; if (c === '{') d++; else if (c === '}') { if (d === 0) break; d-- } e++ }
  return text.slice(s, e + 1)
}

function hasColoredBg(obj) {
  const re = /background(?:Color)?\s*:\s*([^\n]*)/g
  let m
  while ((m = re.exec(obj))) {
    const v = m[1]
    if (/gradient/.test(v)) return true
    for (const h of v.matchAll(/'(#[0-9a-fA-F]{3,8})'/g)) {
      const hex = h[1].toLowerCase()
      if (bgMap[hex] || hex === '#fff' || hex === '#ffffff') continue
      if (hex.length === 9) continue // translucent tint
      return true
    }
    for (const r of v.matchAll(/rgba?\(([^)]*)\)/g)) {
      const parts = r[1].split(',').map(x => parseFloat(x))
      if (parts.length === 4 ? parts[3] >= 0.5 && !(parts[0] === 0 && parts[1] === 0 && parts[2] === 0) : true) return true
    }
  }
  return false
}

let changed = 0, files = 0
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p)
    else if (/\.(jsx|tsx)$/.test(f.name) && !SKIP.test(p)) process_(p)
  }
}

function process_(file) {
  const src = fs.readFileSync(file, 'utf8')
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/)
  // absolute offsets
  const offs = []; let o = 0
  for (const l of lines) { offs.push(o); o += l.length + eol.length }
  const text = lines.join(eol)
  let n = 0
  const out = lines.map((line, i) => {
    let L = line
    const abs = offs[i]
    // backgrounds
    if (/\bbackground(Color)?\s*:/.test(L)) {
      L = L.replace(/'(#[0-9a-fA-F]{3,6})'/g, (m, h) => { const r = bgMap[h.toLowerCase()]; if (r) { n++; return `'${r}'` } return m })
      const fixed = /position:\s*'fixed'|inset:\s*0/.test(enclosing(text, abs + Math.max(0, line.search(/\S/))))
      if (!fixed) {
        L = L.replace(/'rgba\(\s*0,\s*0,\s*0,\s*0?\.(2|25|3|35|4)\s*\)'/g, () => { n++; return `'var(--fill-inset)'` })
        L = L.replace(/'rgba\(\s*255,\s*255,\s*255,\s*0?\.0[1-8]\s*\)'/g, () => { n++; return `'var(--fill-subtle)'` })
      }
    }
    // borders
    if (/\bborder\w*\s*:/.test(L)) {
      L = L.replace(/#[0-9a-fA-F]{3,6}\b(?![0-9a-fA-F])/g, h => { if (BORDER_HEX[h.toLowerCase()]) { n++; return 'var(--border-subtle)' } return h })
      L = L.replace(/rgba\(\s*255,\s*255,\s*255,\s*0?\.(0\d?|1)\s*\)/g, () => { n++; return 'var(--border-subtle)' })
    }
    // text colors
    if (/(^|[\s{,(])color\s*:/.test(L) && !/(background|border)Color/.test(L)) {
      const idx = abs + Math.max(0, L.search(/color\s*:/))
      const obj = enclosing(text, idx)
      const colored = hasColoredBg(obj)
      L = L.replace(/'(#[0-9a-fA-F]{3,6}|white)'/g, (m, h) => {
        const k = h.toLowerCase(); const r = txtMap[k]
        if (!r) return m
        if (TXT[k] === 'strong' && colored) return m
        if ((TXT[k] === 'soft' || TXT[k] === 'muted' || TXT[k] === 'dim') && colored) return m
        n++; return `'${r}'`
      })
    }
    return L
  })
  if (n) { fs.writeFileSync(file, out.join(eol)); changed += n; files++ }
}
walk(ROOT)
console.log(`replacements: ${changed} in ${files} files`)
