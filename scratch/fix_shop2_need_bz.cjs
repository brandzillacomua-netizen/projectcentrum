const fs = require('fs');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Шукаємо рендеринг td потреба
const targetStr = `<td style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                                {displayNeed}
                              </td>`;

const replacement = `<td style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                                {(() => {
                                  const snapEntry = snap[String(item.nom?.id)] || {}
                                  const bzStock = Number(snapEntry.stock) || 0
                                  const totalNeed = Number(snapEntry.need) || displayNeed
                                  const planToProduce = snapEntry.plan !== undefined ? Number(snapEntry.plan) : (totalNeed - bzStock)
                                  
                                  if (bzStock > 0) {
                                    return (
                                      <div>
                                        <div style={{ fontSize: '1.15rem' }}>{totalNeed}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#a1a1aa', fontWeight: 600, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '6px', display: 'inline-block' }}>
                                          БЗ - {bzStock} / Виробити {planToProduce} шт
                                        </div>
                                      </div>
                                    )
                                  }
                                  return displayNeed
                                })()}
                              </td>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Shop2Module.jsx need column with BZ details updated successfully!');
} else {
  // Fallback index replacement for precision
  const idx = content.indexOf('color: \'#fff\', fontSize: \'1.2rem\', fontWeight: 600');
  if (idx !== -1) {
    const startIdx = content.lastIndexOf('<td', idx);
    const endIdx = content.indexOf('</td>', idx) + 5;
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('✅ Shop2Module.jsx need column with BZ details updated successfully via fallback index!');
    }
  } else {
    console.log('❌ Could not find need column pattern!');
  }
}
