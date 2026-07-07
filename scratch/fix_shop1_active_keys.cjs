const fs = require('fs');
const filePath = 'a:/centrum/src/modules/Shop1Terminal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `                const activeCards = workCards.filter(c => {
                  const nom = getNom(c)
                  if (nom && nom.type && nom.type !== 'part') return false

                  const info = String(c.card_info || '')
                  if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false

                  const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
                  if (parentTask) {
                    if (parentTask.status === 'completed') return false
                    if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
                  }

                  if (!CHAIN.includes(c.operation)) return false
                  if (c.status !== 'in-progress' && c.status !== 'at-buffer') return false
                  if (activeTableFilter === 'in-progress' && c.status !== 'in-progress') return false
                  if (activeTableFilter === 'at-buffer' && c.status !== 'at-buffer') return false

                  // Filter by manualId search query
                  if (manualId && manualId.trim()) {
                    const q = translateCyrillic(manualId.trim()).toLowerCase()
                    const nomName = (nom?.name || '').toLowerCase()
                    const nomCode = (nom?.nomenclature_code || '').toLowerCase()
                    const cardSeqMatch = (c.card_info || '').match(/(\\d+\\/\\d+)/)
                    const seq = cardSeqMatch ? cardSeqMatch[1] : ''
                    const cardId = String(c.id).toLowerCase()
                    const orderNum = (allOrdersMap[c.order_id]?.order_num || '').toLowerCase()
                    return nomName.includes(q) || nomCode.includes(q) || seq.includes(q) || cardId.includes(q) || orderNum.includes(q)
                  }

                  return true
                }).sort((a, b) => getCardStartDate(b).getTime() - getCardStartDate(a).getTime())

                if (activeCards.length === 0) {
                  return (
                    <tr><td colSpan={12} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
                  )
                }

                const grouped = { 'Розкрій': [], 'Галтовка': [], 'Прийомка': [], 'Сортування': [] }
                activeCards.forEach(card => {`;

const replacement = `                const activeCardsRaw = workCards.filter(c => {
                  const nom = getNom(c)
                  if (nom && nom.type && nom.type !== 'part') return false

                  const info = String(c.card_info || '')
                  if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false

                  const parentTask = tasks.find(t => String(t.id) === String(c.task_id))
                  if (parentTask) {
                    if (parentTask.status === 'completed') return false
                    if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
                  }

                  if (!CHAIN.includes(c.operation)) return false
                  if (c.status !== 'in-progress' && c.status !== 'at-buffer') return false
                  if (activeTableFilter === 'in-progress' && c.status !== 'in-progress') return false
                  if (activeTableFilter === 'at-buffer' && c.status !== 'at-buffer') return false

                  // Filter by manualId search query
                  if (manualId && manualId.trim()) {
                    const q = translateCyrillic(manualId.trim()).toLowerCase()
                    const nomName = (nom?.name || '').toLowerCase()
                    const nomCode = (nom?.nomenclature_code || '').toLowerCase()
                    const cardSeqMatch = (c.card_info || '').match(/(\\d+\\/\\d+)/)
                    const seq = cardSeqMatch ? cardSeqMatch[1] : ''
                    const cardId = String(c.id).toLowerCase()
                    const orderNum = (allOrdersMap[c.order_id]?.order_num || '').toLowerCase()
                    return nomName.includes(q) || nomCode.includes(q) || seq.includes(q) || cardId.includes(q) || orderNum.includes(q)
                  }

                  return true
                }).sort((a, b) => getCardStartDate(b).getTime() - getCardStartDate(a).getTime())

                const activeCards = Array.from(new Map(activeCardsRaw.map(c => [String(c.id), c])).values())

                if (activeCards.length === 0) {
                  return (
                    <tr><td colSpan={12} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
                  )
                }

                const grouped = { 'Розкрій': [], 'Галтовка': [], 'Прийомка': [], 'Сортування': [] }
                activeCards.forEach(card => {`;

// Normalize line endings to do matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('Successfully updated Shop1Terminal.jsx activeCards keys!');
} else {
  console.log('Target not found in Shop1Terminal.jsx!');
}
