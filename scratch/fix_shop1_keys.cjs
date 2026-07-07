const fs = require('fs');
const filePath = 'a:/centrum/src/modules/Shop1Terminal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `    const filteredQueueCards = queueCards.filter(card => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'new') return card.status === 'new'
      if (queueFilter === 'at-buffer') return card.status === 'at-buffer'
      return true
    })

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px', scrollbarWidth: 'none' }}>
        <style>{\`div::-webkit-scrollbar { display: none; }\`}</style>
        {filteredQueueCards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
            {queueFilter === 'new' ? 'Немає нових карт' : queueFilter === 'at-buffer' ? 'Немає карт в буфері' : 'Черга порожня'}
          </div>
        )}
        {filteredQueueCards.map(card => {`;

const replacement = `    const filteredQueueCards = queueCards.filter(card => {
      if (queueFilter === 'all') return true
      if (queueFilter === 'new') return card.status === 'new'
      if (queueFilter === 'at-buffer') return card.status === 'at-buffer'
      return true
    })

    const uniqueFilteredQueueCards = Array.from(new Map(filteredQueueCards.map(c => [String(c.id), c])).values())

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px', scrollbarWidth: 'none' }}>
        <style>{\`div::-webkit-scrollbar { display: none; }\`}</style>
        {uniqueFilteredQueueCards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Layers size={24} style={{ marginBottom: '10px', opacity: 0.2 }} /><br />
            {queueFilter === 'new' ? 'Немає нових карт' : queueFilter === 'at-buffer' ? 'Немає карт в буфері' : 'Черга порожня'}
          </div>
        )}
        {uniqueFilteredQueueCards.map(card => {`;

// Normalize line endings to do matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('Successfully updated Shop1Terminal.jsx keys!');
} else {
  console.log('Target not found in Shop1Terminal.jsx!');
}
