import fs from 'fs'

// ─── 1. PATCH Shop2Module.jsx ───
const s2ModulePath = 'a:/centrum/src/modules/Shop2Module.jsx'
let s2ModuleContent = fs.readFileSync(s2ModulePath, 'utf8')

// Replace slice(0, 8) or slice(0, 6) references for card display
s2ModuleContent = s2ModuleContent.replace(
  `{String(c.id).slice(0, 8)}...`,
  `#{String(c.id).slice(-8).toUpperCase()}`
)
s2ModuleContent = s2ModuleContent.replace(
  `ID: {card.cardId.slice(0, 8)}`,
  `ID: #{card.cardId.slice(-8).toUpperCase()}`
)
s2ModuleContent = s2ModuleContent.replace(
  `ID: {printModalData.cardId.slice(0, 8)}`,
  `ID: #{printModalData.cardId.slice(-8).toUpperCase()}`
)

fs.writeFileSync(s2ModulePath, s2ModuleContent, 'utf8')
console.log("Patched Shop2Module.jsx successfully.")

// ─── 2. PATCH Shop2Terminal.jsx ───
const s2TerminalPath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let s2TerminalContent = fs.readFileSync(s2TerminalPath, 'utf8')

// Add Search import
s2TerminalContent = s2TerminalContent.replace(
  `X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package, Eye`,
  `X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package, Eye, Search`
)

// Add manualId state variable
s2TerminalContent = s2TerminalContent.replace(
  `const [selectedCardId, setSelectedCardId] = useState(null)`,
  `const [selectedCardId, setSelectedCardId] = useState(null)\n  const [manualId, setManualId] = useState('')`
)

// Insert handleManualEntry function after translateCyrillic
const handleManualEntryCode = `
  const handleManualEntry = async (e) => {
    if (e) e.preventDefault()
    if (!manualId) return

    const cleanInput = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()

    const isMachineQR = await handleMachineQRScan(cleanInput)
    if (isMachineQR) {
      setManualId('')
      setIsScanning(false)
      return
    }

    setIsProcessing(true)

    let card = workCards.find(c => 
      c.card_info?.includes('[ЦЕХ №2]') && (
        String(c.id).trim() === cleanInput || 
        String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
      )
    )
    
    if (!card) {
      if (typeof fetchData === 'function') {
        try { await fetchData(['work_cards']) } catch (e) { }
      }
      card = workCards.find(c => 
        c.card_info?.includes('[ЦЕХ №2]') && (
          String(c.id).trim() === cleanInput || 
          String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
        )
      )
    }

    if (!card) {
      setScanError(\`Картку №\${cleanInput} не знайдено в Цеху №2\`)
    } else {
      setScannedCardIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
      setSelectedCardId(card.id)
      setManualId('')
      setIsScanning(false)
      setScanError(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setIsProcessing(false)
  }
`
s2TerminalContent = s2TerminalContent.replace(
  `const Shop2Terminal = () => {`,
  `const Shop2Terminal = () => {\n${handleManualEntryCode}`
)

// Replace display card numbers with system numbers
s2TerminalContent = s2TerminalContent.replace(
  `ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} | КАРТКА #{currentCard.id.slice(0, 8)}...`,
  `ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} · #{currentCard.id.slice(-8).toUpperCase()}`
)
s2TerminalContent = s2TerminalContent.replace(
  `Картка #{currentCard.id.slice(0, 8)}`,
  `Картка #{currentCard.id.slice(-8).toUpperCase()}`
)
s2TerminalContent = s2TerminalContent.replace(
  `Картка #{card.id.slice(0, 8)}`,
  `Картка #{card.id.slice(-8).toUpperCase()}`
)
s2TerminalContent = s2TerminalContent.replace(
  `Картка №{c.id.slice(0, 6)}`,
  `Картка №{c.id.slice(-8).toUpperCase()}`
)

// Add search form inside the header in Shop2Terminal.jsx
const headerSearchForm = `
          <form onSubmit={handleManualEntry} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e0e12', border: '1px solid #222', padding: '6px 10px', borderRadius: '10px', marginLeft: '15px' }}>
            <Search size={14} color="#6b7280" />
            <input
              type="text"
              placeholder="Системний номер..."
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              disabled={isProcessing}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700, outline: 'none', width: '130px' }}
            />
            <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isProcessing ? <RefreshCw size={10} className="anim-spin" /> : 'ЗНАЙТИ'}
            </button>
          </form>`

s2TerminalContent = s2TerminalContent.replace(
  `<h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ №2 (ОПЕРАТОР)</h1>`,
  `<h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ №2 (ОПЕРАТОР)</h1>\n${headerSearchForm}`
)

// Also let's append system number to renderQueue cards
s2TerminalContent = s2TerminalContent.replace(
  `<strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>`,
  `<strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>\n              <span style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800 }}>#{card.id.slice(-8).toUpperCase()}</span>`
)

fs.writeFileSync(s2TerminalPath, s2TerminalContent, 'utf8')
console.log("Patched Shop2Terminal.jsx successfully.")
