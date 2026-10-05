// Repair: codemod wrongly converted `color: '#000'` (dark text on colored buttons) into surface tokens
// when a `background` key was on the same line. Restore those to literal dark text colors.
const fs = require('fs'), path = require('path')
const back = { black: '#000', inset: '#0a0a0a', 1: '#111', 2: '#1a1a1a', 3: '#222' }
let n = 0, files = 0
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) walk(p)
    else if (/\.(jsx|tsx)$/.test(f.name)) fix(p)
  }
}
function fix(p) {
  let t = fs.readFileSync(p, 'utf8'), c = 0
  // any `color:` (not backgroundColor/borderColor) whose value expression contains a surface token
  t = t.replace(/((?:^|[\s{,(])color\s*:)([^\n]*)/g, (m, key, rest) => {
    // value ends at first top-level ',' or '}' (outside quotes/parens)
    let depth = 0, q = null, end = rest.length
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i]
      if (q) { if (ch === q) q = null; continue }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue }
      if (ch === '(' || ch === '[') depth++
      else if (ch === ')' || ch === ']') depth--
      else if (depth === 0 && (ch === ',' || ch === '}')) { end = i; break }
    }
    const val = rest.slice(0, end).replace(/var\(--surface-(black|inset|1|2|3)\)/g, (_, k) => { c++; return back[k] })
    return key + val + rest.slice(end)
  })
  if (c) { fs.writeFileSync(p, t); n += c; files++ }
}
walk(path.join(__dirname, '..', 'src'))
console.log(`restored ${n} in ${files} files`)
