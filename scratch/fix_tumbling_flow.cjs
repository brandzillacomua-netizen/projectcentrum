const fs = require('fs');

const filePath = 'a:/centrum/src/modules/TumblingTerminal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update isWaiting check in handleCardActionById (around line 171)
content = content.replace(
  `const isWaiting = card.status === 'at-buffer' && (card.operation === 'Розкрій' || card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)')`,
  `const isWaiting = 
        (card.status === 'at-buffer' && (card.operation === 'Розкрій' || card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)')) ||
        (card.status === 'new' && (card.operation === 'Галтовка (Вібростіл)' || card.operation === 'Галтовка (Мийка)' || card.operation === 'Галтовка (Галтовка)' || card.operation === 'Галтовка (Сушка)'))`
);

// 2. Update nextOp logic in startTumblingCard (around line 209)
content = content.replace(
  `const nextOp = getNextTumblingOperation(card.operation)`,
  `const nextOp = card.status === 'new' ? card.operation : getNextTumblingOperation(card.operation)`
);

// 3. Update waitingCards memo (around line 507)
content = content.replace(
  `  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)'))`,
  `  const waitingCards = useMemo(() => {
    return workCards
      .filter(c => 
        (c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)'))
      )`
);

// 4. Update displayedCards sub-stage filter (around line 562)
content = content.replace(
  `    // Apply subStageFilter
    if (subStageFilter !== 'all') {
      list = list.filter(c => {
        if (c.type === 'waiting') {
          // Waiting cards: operation indicates the PREVIOUS stage
          if (subStageFilter === 'вибростил') return c.operation === 'Розкрій'
          if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Мийка)'
          if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Галтовка)'
        } else {`,
  `    // Apply subStageFilter
    if (subStageFilter !== 'all') {
      list = list.filter(c => {
        if (c.type === 'waiting') {
          // Waiting cards: if 'new', targets current op; if 'at-buffer', targets next op
          const targetOp = c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)
          if (subStageFilter === 'вибростил') return targetOp === 'Галтовка (Вібростіл)'
          if (subStageFilter === 'мийка') return targetOp === 'Галтовка (Мийка)'
          if (subStageFilter === 'галтовка') return targetOp === 'Галтовка (Галтовка)'
          if (subStageFilter === 'сушка') return targetOp === 'Галтовка (Сушка)'
        } else {`
);

// 5. Update header sub-stages filter counters (around line 724)
content = content.replace(
  `                { id: 'вибростил', label: '1 - Вібростіл', count: waitingCards.filter(c => c.operation === 'Розкрій').length + inWorkCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length },
                { id: 'мийка', label: '2 - Мийка', count: waitingCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Мийка)').length },
                { id: 'галтовка', label: '3 - Галтовка', count: waitingCards.filter(c => c.operation === 'Галтовка (Мийка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Галтовка)').length },
                { id: 'сушка', label: '4 - Сушка', count: waitingCards.filter(c => c.operation === 'Галтовка (Галтовка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Сушка)').length }`,
  `                { id: 'вибростил', label: '1 - Вібростіл', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Вібростіл)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length },
                { id: 'мийка', label: '2 - Мийка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Мийка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Мийка)').length },
                { id: 'галтовка', label: '3 - Галтовка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Галтовка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Галтовка)').length },
                { id: 'сушка', label: '4 - Сушка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Сушка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Сушка)').length }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed tumbling flow in TumblingTerminal.jsx!');
