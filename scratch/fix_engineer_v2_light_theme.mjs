import fs from 'fs'

const files = [
  'b:/kylutsya/src/modules/EngineerModule.jsx',
  'b:/kylutsya/src/modules/EngineerV2Module.jsx'
]

files.forEach(targetPath => {
  if (!fs.existsSync(targetPath)) return
  let code = fs.readFileSync(targetPath, 'utf8')

// 1. Fix Catalog Header banner
code = code.replace(
  /background: 'linear-gradient\(135deg, #0d0d1a, #12122a\)', border: '1px solid #2a2a5a'/g,
  "background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'"
)
code = code.replace(/color: '#c7d2fe'/g, "color: 'var(--text-main, #0f172a)'")
code = code.replace(/color: '#4a4a7a'/g, "color: 'var(--text-muted, #64748b)'")

// 2. Fix Header Buttons
code = code.replace(/background: '#111', color: '#818cf8', border: '1px solid #2a2a5a'/g, "background: 'var(--button-bg, #f1f5f9)', color: 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)'")
code = code.replace(/background: viewMode === 'editor' \? 'linear-gradient\(135deg,#4f46e5,#7c3aed\)' : '#111', color: '#fff', border: '1px solid #2a2a4a'/g, "background: viewMode === 'editor' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'editor' ? '#ffffff' : 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)'")
code = code.replace(/background: viewMode === 'catalog' \? 'linear-gradient\(135deg,#4f46e5,#7c3aed\)' : '#111', color: '#fff', border: '1px solid #2a2a4a'/g, "background: viewMode === 'catalog' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'catalog' ? '#ffffff' : 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)'")
code = code.replace(/background: '#1a0f2e', color: '#a78bfa', border: '1px solid #4c1d9533'/g, "background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)'")

// 3. Fix Catalog Search Input
code = code.replace(/background: '#111', border: '1px solid #1e1e1e', color: '#fff'/g, "background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)'")

// 4. Fix Catalog Item Cards (The washed-out red cards in screenshot!)
code = code.replace(
  /background: isEmpty \? 'rgba\(239, 68, 68, 0\.05\)' : '#0d0d0d',\s*border: isEmpty \? '1px solid rgba\(239, 68, 68, 0\.5\)' : '1px solid #1a1a1a',/g,
  `background: isEmpty ? 'var(--card-bg, #ffffff)' : 'var(--card-bg, #ffffff)',
   border: isEmpty ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color, #e2e8f0)',
   boxShadow: isEmpty ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 10px rgba(0,0,0,0.03)',`
)

// Item title text:
code = code.replace(/color: isEmpty \? '#fca5a5' : '#c7d2fe'/g, "color: 'var(--text-main, #0f172a)'")

// Empty badge tag:
code = code.replace(/background: '#ef4444',/g, "background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',")

// Badge TYPE_COLORS for Light Mode legibility:
code = code.replace(/const TYPE_COLORS = \{ product: '#f59e0b', part: '#60a5fa', raw: '#34d399', consumable: '#f87171', assembly: '#a78bfa' \}/g,
  "const TYPE_COLORS = { product: '#d97706', part: '#2563eb', raw: '#059669', consumable: '#dc2626', assembly: '#7c3aed' }"
)

// Empty text item count:
code = code.replace(/color: isEmpty \? '#ef4444' : '#555'/g, "color: isEmpty ? '#dc2626' : 'var(--text-muted, #64748b)'")

// Fill Button (+ Наповнити специфікацію):
code = code.replace(
  /background: isEmpty \? '#ef4444' : 'rgba\(99,102,241,0\.05\)',\s*border: isEmpty \? 'none' : '1px solid #6366f120',\s*color: isEmpty \? '#fff' : '#818cf8'/g,
  `background: isEmpty ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)',
   border: isEmpty ? 'none' : '1px solid var(--border-color, #cbd5e1)',
   color: isEmpty ? '#ffffff' : 'var(--text-main, #0f172a)'`
)

// 5. Fix Editor Parent Selector box
code = code.replace(/background: '#0d0d0d', border: '1px solid #1e1e1e'/g, "background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'")
code = code.replace(/color: '#888'/g, "color: 'var(--text-muted, #64748b)'")
code = code.replace(/background: parentId \? '#0f1a2e' : '#111'/g, "background: 'var(--input-bg, #ffffff)'")
code = code.replace(/border: `1px solid \${parentId \? '#1d4ed840' : '#2a2a2a'}`/g, "border: '1px solid var(--border-color, #cbd5e1)'")

  fs.writeFileSync(targetPath, code, 'utf8')
  console.log(`Successfully applied Light Mode contrast enhancements to ${targetPath}!`)
})
